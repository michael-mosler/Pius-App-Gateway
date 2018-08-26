const Config = require('./Config');

/**
 * Delta list payload definition.
 * @property {String} type - Item type; ADDED, DELETED, CHANGED
 * @property {Array<String>} detailsNew - New detail items (for ADDED or CHANGED)
 * @property {Array<String>} detailsOld - Old detail items (for DELETED OR CHANGED)
 */
class DeltaItem {
  constructor({ type, detailsNew = null, detailsOld = null }) {
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

        // Messe is substituted by another course and not just by an empty item.
        if (!secondCourse || secondCourse.search(/^[A-Z]/) === -1) {
          return true;
        }

        // Alternate definition of empty course, e.g. ---
        if (secondCourse.search(/^[^A-Z]/) !== -1) {
          return true;
        }

        currentCourse = secondCourse;
      }

      // The real filter.
      return normalizedCourseList.includes(currentCourse);
    });

    return filteredVertretungsplanItems;
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
    const deltaList = [];
    const newSchedule = changeListItem.substitutionSchedule;
    const oldSchedule = VertretungsplanHelper.synchronizeSchedule(newSchedule.dateItems[0].title, changeListItem.oldSubstitutionSchedule);

    for (let dateIndex = 0; dateIndex < newSchedule.dateItems.length; dateIndex++) {
      const gradeItemsNew = newSchedule.dateItems[dateIndex].gradeItems;
      const gradeItemsOld = oldSchedule.dateItems[dateIndex].gradeItems;

      // Both grade item lists are empty.
      if (gradeItemsNew.length === 0 && gradeItemsOld.length === 0) {
        continue;
      }

      // New grade item list is empty but old is not
      if (gradeItemsNew.length === 0 && gradeItemsOld.length !== 0) {
        gradeItemsOld.vertretungsplanItems.forEach(item => deltaList.push(new DeltaItem({ type: 'DELETED', detailsOld: item.detailItems })));
        continue;
      }

      // Old grade item list is empty but new is not.
      if (gradeItemsNew.length !== 0 && gradeItemsOld.length === 0) {
        gradeItemsNew.vertretungsplanItems.forEach(item => deltaList.push(new DeltaItem({ type: 'ADDED', detailsNew: item.detailItems })));
        continue;
      }

      // Apply course list filter to itemlist.
      if (courseList) {
        gradeItemsNew[0].vertretungsplanItems = VertretungsplanHelper.filterByCourselist(gradeItemsNew[0].vertretungsplanItems, courseList);
        gradeItemsOld[0].vertretungsplanItems = VertretungsplanHelper.filterByCourselist(gradeItemsOld[0].vertretungsplanItems, courseList);
      }

      // Which lessons are in new list but not in old list? These have been added.
      let newGradeItemsNew = [];
      gradeItemsNew[0].vertretungsplanItems.forEach((newItem) => {
        const index = gradeItemsOld[0].vertretungsplanItems.findIndex(oldItem => oldItem.detailItems[0] === newItem.detailItems[0] && oldItem.detailItems[2] === newItem.detailItems[2]);
        if (index === -1) {
          deltaList.push(new DeltaItem({ type: 'ADDED', detailsNew: newItem.detailItems }));
        } else {
          newGradeItemsNew.push(newItem);
        }
      });

      gradeItemsNew[0].vertretungsplanItems = newGradeItemsNew;

      // Which lessons are in old list but not in new? These have been deleted.
      let newGradeItemsOld = [];
      gradeItemsOld[0].vertretungsplanItems.forEach((oldItem) => {
        const index = gradeItemsNew[0].vertretungsplanItems.findIndex(newItem => newItem.detailItems[0] === oldItem.detailItems[0] && newItem.detailItems[2] === oldItem.detailItems[2]);
        if (index === -1) {
          deltaList.push(new DeltaItem({ type: 'DELETED', detailsOld: oldItem.detailItems }));
        } else {
          newGradeItemsOld.push(oldItem);
        }
      });

      gradeItemsOld[0].vertretungsplanItems = newGradeItemsOld;

      // Compare items that are left in both list. The lists are in sync now, thus we can use
      // a single index.
      gradeItemsNew[0].vertretungsplanItems.forEach((newItem, index) => {
        const identical = newItem.detailItems.reduce((a, item, itemIndex) => {
          return a && item === gradeItemsOld[0].vertretungsplanItems[index].detailItems[itemIndex];
        }, true);

        if (!identical) {
          deltaList.push(new DeltaItem({ type: 'CHANGED', detailsNew: newItem.detailItems, detailsOld: gradeItemsOld[0].vertretungsplanItems[index].detailItems }));
        }
      });
    }

    return deltaList;
  }
}

module.exports = VertretungsplanHelper;
