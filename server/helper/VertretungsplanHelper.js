const request = require('request');
const util = require('util');
const clone = require('clone');
const LogService = require('../helper/LogService');
const Config = require('../core-services/Config');

/**
 * Delta list payload definition.
 * @property {String} type - Item type; ADDED, DELETED, CHANGED
 * @property {Array<String>} detailsNew - New detail items (for ADDED or CHANGED)
 * @property {Array<String>} detailsOld - Old detail items (for DELETED OR CHANGED)
 * @property {Number} ord - Ordinary number of item; items can be sorted by this number is timely order
 */
class DeltaItem {
  constructor({ date, type, detailsNew = null, detailsOld = null }) {
    this.date = date;
    this.type = type;
    this.detailsNew = detailsNew;
    this.detailsOld = detailsOld;
  }

  get ord() {
    const l = this.date.length;

    // Prefer lesson info from new details. Extract lesson and normalize to two digits.
    const details = this.detailsNew || this.detailsOld;
    const lesson = (details[0].match(/\d+/) || ['99'])[0].padStart(2, '0');

    // Ordinary number from YYYYMMDDLL (LL = lesson)
    return parseInt(`${this.date.substring(l - 4)}${this.date.substring(l - 7, l - 5)}${this.date.substring(l - 10, l - 8)}${lesson}`);
  }
}

class VertretungsplanHelper {
  /**
   * Returns true if the given grade is an upper grade.
   * @param {String} grade - Grade to check
   * @returns {Boolean} - True if grade is an upper grade.
   * @static
   */
  static isUpperGrade(grade) {
    return Config.upperGrades.includes(grade);
  }

  /**
   * Syncs a given schedule onto a sync. point, i.e. all date items from schedule that lay before
   * sync point are removed.
   * @param {String} syncPoint - Date String from schedule to sync on.
   * @param {Object} schedule - The schedule that shall be synced
   * @returns {Object} - Synced schedule
   * @static
   * @private
   */
  static synchronizeSchedule(syncPoint, schedule) {
    const syncedSchedule = schedule;
    const index = schedule.dateItems.findIndex(item => item.title === syncPoint);

    if (index === -1) {
      syncedSchedule.dateItems = [];
    } else {
      syncedSchedule.dateItems = schedule.dateItems.slice(index);
    }

    return syncedSchedule;
  }

  /**
   * Filter vertretungsplanItems by course list, i.e. remove all detail items that do not
   * refer to a course from course list.
   * @param {Array<Object>} vertretungsplanItems
   * @param {Array<String>} courseList
   * @returns {vertretungsplanItems} - Filtered vertretungsplanItems.
   * @static
   * @private
   */
  static filterByCourselist(vertretungsplanItems, courseList) {
    const normalizedCourseList = courseList.map(course => course
      .replace(/ +/g, '')
      .replace('GK', 'G')
      .replace('LK', 'L')
      .replace('ZK', 'Z'));

    const filteredVertretungsplanItems = vertretungsplanItems.filter((item) => {
      let currentCourse = item.detailItems[2].replace(/ +/g, '');

      // Sondereinsatz is indicated by an empty course property.
      if (currentCourse.length === 0) {
        return true;
      }

      // Messe, if substituted by another course apply course list filter otherwise
      // keep item.
      if (currentCourse.substring(0, 3) === 'Mes') {
        const secondCoursePos = currentCourse.search('&rarr;') + 6;
        const secondCourse = currentCourse.substring(secondCoursePos);

        // Messe is substituted by by no course.
        if (!secondCourse || secondCourse.search(/^[A-Z]/) === -1) {
          return true;
        }

        currentCourse = secondCourse;
      }

      // Alternate definition of empty course, e.g. ---
      if (currentCourse.search(/^[^A-Z]/) !== -1) {
        return true;
      }

      // The real filter.
      return normalizedCourseList.includes(currentCourse);
    });

    return filteredVertretungsplanItems;
  }

  /**
   * Compares two detail items. Items are supposed to be equal when properties course and lesson are equal except for
   * the case of "Sondereinsatz". This requires also property teacher to equal.
   * This is a simplified check that is used to detect added or deleted items. It does not compare all properties!
   * @param {Array<String>} detailItems1 - Detail items list 1
   * @param {Array<String>} detailItems2 - Detail items list 2
   * @returns {Boolean} True when both items are equal
   */
  static sameLesson(detailItems1, detailItems2) {
    // For Sondereinsatz it is not sufficient to compare items 0 and 2 (Course, Lesson) but we also need to compare
    // room and teacher. Otherwise it is likely to happen that two different "Sondereinsatz"-items are supposed to be equal.
    if (detailItems1[1].trim() === 'Sondereinsatz' && detailItems2[1].trim() === 'Sondereinsatz') {
      return detailItems1[0] === detailItems2[0] && detailItems1[2] === detailItems2[2] && detailItems1[3] === detailItems2[3] && detailItems1[4] === detailItems2[4];
    }

    // Mitbetreuung: This is even more tricky than Sondereinsatz. Two items refer to the same lesson only if properties 0 to 5 are equal.
    // This is especially important when "Foerderkurse" which are actually splitted are joined.
    if (detailItems1[1].trim() === 'Mitbetreuung' && detailItems2[1].trim() === 'Mitbetreuung') {
      return detailItems1[0] === detailItems2[0] && detailItems1[2] === detailItems2[2] && detailItems1[3] === detailItems2[3] && detailItems1[4] === detailItems2[4] && detailItems1[5] === detailItems2[5];
    }

    // Klausur: This may clash with a substitution for the same lesson. Thus, old and new are equal iff both are a Klausur in
    // same lesson and course.
    if (detailItems1[1].trim() === 'Klausur' || detailItems2[1].trim() === 'Klausur') {
      return detailItems1[0] === detailItems2[0] && detailItems1[1] === detailItems2[1] && detailItems1[2] === detailItems2[2];
    }

    return detailItems1[0] === detailItems2[0] && detailItems1[2] === detailItems2[2];
  }

  /**
   * Compares current and old schedule given in changeListItem. It returns an array of delta objects. The array
   * will be empty when no delta exists.
   * @param {Object} changeListItem - Object thar holds old and new schedule.
   * @param {Array<String>} courseList - For upper grade classes the courselist that is to be applied as pre-filter.
   * @returns {Array<Object>}
   * @static
   */
  static delta(changeListItem, courseList = null) {
    try {
      const deltaList = [];
      const newSchedule = clone(changeListItem.substitutionSchedule);
      const [{ title: syncTitle } = { title: '' }] = newSchedule.dateItems;
      const oldSchedule = clone(VertretungsplanHelper.synchronizeSchedule(syncTitle, changeListItem.oldSubstitutionSchedule));

      for (let dateIndex = 0; dateIndex < Math.max(newSchedule.dateItems.length, oldSchedule.dateItems.length); dateIndex++) {
        let titleNew = null;
        let titleOld = null;
        let gradeItemsNew, gradeItemsOld;

        if (newSchedule.dateItems[dateIndex]) {
          const dateItem = newSchedule.dateItems[dateIndex];
          titleNew = (dateItem) ? dateItem.title : '';
          gradeItemsNew = newSchedule.dateItems[dateIndex].gradeItems;
        } else {
          gradeItemsNew = [];
        }

        if (oldSchedule.dateItems[dateIndex]) {
          const dateItem = newSchedule.dateItems[dateIndex];
          titleOld = (dateItem) ? dateItem.title : '';
          gradeItemsOld = oldSchedule.dateItems[dateIndex].gradeItems;
        } else {
          gradeItemsOld = [];
        }

        // Both grade item lists are empty.
        if (gradeItemsNew.length === 0 && gradeItemsOld.length === 0) {
          continue;
        }

        // Apply course list filter to itemlist.
        if (courseList) {
          if (gradeItemsNew.length > 0) {
            gradeItemsNew[0].vertretungsplanItems = VertretungsplanHelper.filterByCourselist(gradeItemsNew[0].vertretungsplanItems, courseList);
          }

          if (gradeItemsOld.length > 0) {
            gradeItemsOld[0].vertretungsplanItems = VertretungsplanHelper.filterByCourselist(gradeItemsOld[0].vertretungsplanItems, courseList);
          }
        }

        // New grade item list is empty but old is not
        if (gradeItemsNew.length === 0 && gradeItemsOld.length !== 0) {
          gradeItemsOld[0].vertretungsplanItems.forEach(item => deltaList.push(new DeltaItem({ date: titleOld, type: 'DELETED', detailsOld: item.detailItems })));
          continue;
        }

        // Old grade item list is empty but new is not.
        if (gradeItemsNew.length !== 0 && gradeItemsOld.length === 0) {
          gradeItemsNew[0].vertretungsplanItems.forEach(item => deltaList.push(new DeltaItem({ date: titleNew, type: 'ADDED', detailsNew: item.detailItems })));
          continue;
        }

        // Which lessons are in new list but not in old list? These have been added.
        const newVertretungsplanItemsNew = [];
        gradeItemsNew[0].vertretungsplanItems.forEach((newItem) => {
          const index = gradeItemsOld[0].vertretungsplanItems.findIndex(oldItem => VertretungsplanHelper.sameLesson(oldItem.detailItems, newItem.detailItems));
          if (index === -1) {
            deltaList.push(new DeltaItem({ date: titleNew, type: 'ADDED', detailsNew: newItem.detailItems }));
          } else {
            newVertretungsplanItemsNew.push(newItem);
          }
        });

        gradeItemsNew[0].vertretungsplanItems = newVertretungsplanItemsNew;

        // Which lessons are in old list but not in new? These have been deleted.
        const newVertretungsplanItemsOld = [];
        gradeItemsOld[0].vertretungsplanItems.forEach((oldItem) => {
          const index = gradeItemsNew[0].vertretungsplanItems.findIndex(newItem => VertretungsplanHelper.sameLesson(newItem.detailItems, oldItem.detailItems));
          if (index === -1) {
            deltaList.push(new DeltaItem({ date: titleOld, type: 'DELETED', detailsOld: oldItem.detailItems }));
          } else {
            newVertretungsplanItemsOld.push(oldItem);
          }
        });

        gradeItemsOld[0].vertretungsplanItems = newVertretungsplanItemsOld;

        // Compare items that are left in both lists. There are rare conditions in which lists are still
        // not in sync. E.g. new list might be longer than old one. Following code has to handle this
        // situation, but we will also dump data so that we can learn when this happens.
        // One known situation is a split of an existing substitution into two with lesson and course
        // remaining the same. New list will then hold two items where old has only one. This
        // change is not detected before because actually all items look the same in terms of changes
        // we can detect.
        if (gradeItemsNew[0].vertretungsplanItems.length !== gradeItemsOld[0].vertretungsplanItems.length) {
          const logService = new LogService();
          logService.logger.warn(
            'VertretungsplanHelper.delta: Assertion failed. Expected new and old lists to be in sync but they aren\'t.\n' +
            `New: ${util.inspect(gradeItemsNew[0].vertretungsplanItems, { depth: 8 })}\n` +
            `Old: ${util.inspect(gradeItemsOld[0].vertretungsplanItems, { depth: 8 })}`);
        }

        gradeItemsNew[0].vertretungsplanItems.forEach((newItem, index) => {
          const oldDetailItems = (gradeItemsOld[0].vertretungsplanItems[index] || {}).detailItems;
          const identical = oldDetailItems && newItem.detailItems.reduce((a, item, itemIndex) => {
            return a && item === oldDetailItems[itemIndex];
          }, true);

          // Not identical.
          if (!identical) {
            if (oldDetailItems) {
              deltaList.push(new DeltaItem({ date: titleNew, type: 'CHANGED', detailsNew: newItem.detailItems, detailsOld: gradeItemsOld[0].vertretungsplanItems[index].detailItems }));
            } else {
              deltaList.push(new DeltaItem({ date: titleNew, type: 'ADDED', detailsNew: newItem.detailItems }));
            }
          }
        });
      }

      return deltaList.sort((item1, item2) => item1.ord - item2.ord);
    } catch (err) {
      const logService = new LogService();
      logService.logger.error(`delta() failed with ${err}.\nInput: ${util.inspect(changeListItem, { depth: 8 })}\ncourse list: ${util.inspect(courseList, { depth: 8 })}`);
      throw err;
    }
  }

  /**
   * The method validates login information that is given as basic authentication data.
   * The data is checked by sending a HEAD request to Pius web site for URL /vertretungsplan.
   * The HTTP status code simply is returned to App.
   * @param {IncomingMessage} req - HTTP request object
   * @returns {Promise<Number|Error>} - Returns HTTP status code or error object
   */
  static validateLogin(req) {
    const options = {
      url: 'https://pius-gymnasium.de/vertretungsplan/',
      headers: {
        Authorization: req.header('authorization'),
      },
    };

    return new Promise((resolve, reject) => {
      request.head(options, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.statusCode);
        }
      });
    });
  }
}

module.exports = VertretungsplanHelper;
