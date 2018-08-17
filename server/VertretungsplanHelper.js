const Config = require('./Config');

class DeltaItem {
  constructor(type) {
    this.type = type;
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
   * Compares current and old schedule given in changeListItem. It returns an array of delta objects. The array
   * will be empty when no delta exists.
   * @param {Object} changeListItem - Object thar holds old and new schedule.
   * @returns {Array<Object>}
   * @static
   */
  static delta(changeListItem) {
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
        gradeItemsOld.vertretungsplanItems.forEach(item => deltaList.push('DELETED'));
        continue;
      }

      // Old grade item list is empty but new is not.
      if (gradeItemsNew.length !== 0 && gradeItemsOld.length === 0) {
        gradeItemsNew.vertretungsplanItems.forEach(item => deltaList.push('ADDED'));
        continue;
      }

      // Which lessons are in new list but not in old list? These have been added.
      let newGradeItemsNew = [];
      gradeItemsNew[0].vertretungsplanItems.forEach((newItem) => {
        const index = gradeItemsOld[0].vertretungsplanItems.findIndex(oldItem => oldItem.detailItems[0] === newItem.detailItems[0] && oldItem.detailItems[2] === newItem.detailItems[2]);
        if (index === -1) {
          deltaList.push('ADDED');
        } else {
          newGradeItemsNew.push(newItem);
        }
      });

      gradeItemsNew.vertretungsplanItems = newGradeItemsNew;

      // Which lessons are in old list but not in new? These have been deleted.
      let newGradeItemsOld = [];
      gradeItemsOld[0].vertretungsplanItems.forEach((oldItem) => {
        const index = gradeItemsNew[0].vertretungsplanItems.findIndex(newItem => newItem.detailItems[0] === oldItem.detailItems[0] && newItem.detailItems[2] === oldItem.detailItems[2]);
        if (index === -1) {
          deltaList.push('DELETED');
        } else {
          newGradeItemsOld.push(oldItem);
        }
      });

      gradeItemsOld.vertretungsplanItems = newGradeItemsOld;

      // Compare items that are left in both list. The lists are in sync now, thus we can use
      // a single index.
      gradeItemsNew[0].vertretungsplanItems.forEach((newItem, index) => {
        const identical = newItem.detailItems.reduce((a, item, itemIndex) => {
          return a && item === gradeItemsOld[0].vertretungsplanItems[index].detailItems[itemIndex];
        }, true);

        if (!identical) {
          deltaList.push('CHANGED');
        }
      });
    }

    return deltaList;
  }
}

module.exports = VertretungsplanHelper;
