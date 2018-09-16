const util = require('util');
const clone = require('clone');
const Config = require('./Config');

/**
 * Delta list payload definition.
 * @property {String} type - Item type; ADDED, DELETED, CHANGED
 * @property {Array<String>} detailsNew - New detail items (for ADDED or CHANGED)
 * @property {Array<String>} detailsOld - Old detail items (for DELETED OR CHANGED)
 */
class DeltaItem {
  constructor({ date, type, detailsNew = null, detailsOld = null }) {
    this.date = date;
    this.type = type;
    this.detailsNew = detailsNew;
    this.detailsOld = detailsOld;
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
      .replace('LK', 'L'));

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
      const oldSchedule = clone(VertretungsplanHelper.synchronizeSchedule(newSchedule.dateItems[0].title, changeListItem.oldSubstitutionSchedule));

      for (let dateIndex = 0; dateIndex < Math.max(newSchedule.dateItems.length, oldSchedule.dateItems.length); dateIndex++) {
        let titleNew = null;
        let titleOld = null;
        let gradeItemsNew, gradeItemsOld;

        if (newSchedule.dateItems[dateIndex]) {
          titleNew = newSchedule.dateItems[dateIndex].title;
          gradeItemsNew = newSchedule.dateItems[dateIndex].gradeItems;
        } else {
          gradeItemsNew = [];
        }

        if (oldSchedule.dateItems[dateIndex]) {
          titleOld = oldSchedule.dateItems[dateIndex].title;
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
        let newVertretungsplanItemsNew = [];
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
        let newVertretungsplanItemsOld = [];
        gradeItemsOld[0].vertretungsplanItems.forEach((oldItem) => {
          const index = gradeItemsNew[0].vertretungsplanItems.findIndex(newItem => VertretungsplanHelper.sameLesson(newItem.detailItems, oldItem.detailItems));
          if (index === -1) {
            deltaList.push(new DeltaItem({ date: titleOld, type: 'DELETED', detailsOld: oldItem.detailItems }));
          } else {
            newVertretungsplanItemsOld.push(oldItem);
          }
        });

        gradeItemsOld[0].vertretungsplanItems = newVertretungsplanItemsOld;

        // Compare items that are left in both lists. The lists are in sync now, thus we can use
        // a single index.
        gradeItemsNew[0].vertretungsplanItems.forEach((newItem, index) => {
          const identical = newItem.detailItems.reduce((a, item, itemIndex) => {
            return a && item === gradeItemsOld[0].vertretungsplanItems[index].detailItems[itemIndex];
          }, true);

          // Not identical or EVA has been deleted.
          if (!identical || gradeItemsNew[0].vertretungsplanItems.length !== gradeItemsOld[0].vertretungsplanItems.length) {
            deltaList.push(new DeltaItem({ date: titleNew, type: 'CHANGED', detailsNew: newItem.detailItems, detailsOld: gradeItemsOld[0].vertretungsplanItems[index].detailItems }));
          }
        });
      }

      return deltaList;
    } catch (err) {
      console.log(`ERROR: delta() failed with ${err}.\nInput: ${util.inspect(changeListItem, { depth: 6 })}\ncourse list: ${util.inspect(courseList, { depth: 6 })}`);
      throw err;
    }
  }
}

module.exports = VertretungsplanHelper;
