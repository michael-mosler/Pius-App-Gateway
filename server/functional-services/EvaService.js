const util = require('util');
const md5 = require('md5');
const _ = require('underscore');
const { EvaItem, EvaCollectionItem, EvaDoc } = require('../data-objects/EvaServiceData');
const CloudantDb = require('../core-services/CloudantDb');
const PushEventEmitter = require('./PushEventEmitter');
const VertretungsplanHelper = require('../helper/VertretungsplanHelper');

/**
 * This class provides all required functions to manage
 * EVA history. This comprises:
 *
 * + Updating current EVA history
 * + Housekeeping, i.e. deleting outdated entries from the history
 * + Delivery of EVA data
 *
 * EVA data is maintained for upper grades only. It is organized on a per course basis.
 * Data is sorted by 1st date and 2nd course. Class {@link EvaItem} defines the actual
 * payload.
 */
class EvaService {
  constructor() {
    this.evaDb = new CloudantDb('eva');
    this.pushEventEmitter = new PushEventEmitter();
    this.pushEventEmitter.on('push', changeListItem => this.updateFrom(changeListItem));
  }

  /**
   * Receives a change list, extracts EVA texts from it and adds these to the current
   * context map. The function is triggered by push event. Update requests for
   * lower grades are ignored.
   * @param {Object} changeListItem - Change list as also received by {@link Pusher}
   * @private
   */
  async updateFrom(changeListItem) {
    if (!VertretungsplanHelper.isUpperGrade(changeListItem.grade)) {
      return;
    }

    try {
      console.log(`Updating EVA for ${changeListItem.grade}`);

      const doc = await this.evaDb.get(changeListItem.grade);
      let evaDoc = new EvaDoc(_.extend(doc, { _id: changeListItem.grade }));

      const { substitutionSchedule } = changeListItem;

      substitutionSchedule.dateItems.forEach(dateItem => {
        const { title: date } = dateItem;
        const { gradeItems = [] } = dateItem;

        // When gradeItems is not empty there will be one entry only.
        // This entry is the grade where we are exracting EVA for.
        gradeItems.forEach(gradeItem => {
          const { grade } = gradeItem;
          const { vertretungsplanItems = [] } = gradeItem;
          const evaItems = vertretungsplanItems
            .filter(vertretungsplanItem => vertretungsplanItem.detailItems[7] !== undefined)
            .map(vertretungsplanItem => new EvaItem(vertretungsplanItem.detailItems[2], vertretungsplanItem.detailItems[7]));

          console.log(`Merging items for ${grade}, ${date}: ${util.inspect(evaItems, { depth: 2 })}`);

          // When new items are not contained in doc merge them.
          const newEvaCollectionItem = new EvaCollectionItem(date, evaItems);
          if (!evaDoc.contains(newEvaCollectionItem)) {
            evaDoc = evaDoc.merge(newEvaCollectionItem);
          }
        });
      });

      const newHash = md5(JSON.stringify(evaDoc.evaCollection));
      console.log(`EVA doc ${changeListItem.grade} hash: new = ${newHash}, old = ${evaDoc.hash}`);
      // if (true || evaDoc.hash !== newHash) {

      evaDoc.hash = newHash;
      console.log(`Writing new EVA doc ${util.inspect(evaDoc, { depth: 4 })}`);
      return this.evaDb.insertDocument(evaDoc);

      // } else {
      //   console.log(`Digest has not changed, skipping update for ${changeListItem.grade}`);
      // }
    } catch (err) {
      console.log(`Failed to store updated EVA doc: ${err}`);
    }
  }

  /**
   * Gets EVA items for a given grade and optional course list.
   * @param {String} grade - Grade EVA items shall be got for
   * @param {*} courseList - Course list to filter on, may be empty
   * @returns {Promise<CollectionItems|Error>}
   */
  async getEvaItems(grade, courseList = null) {
    const evaDoc = await this.evaDb.get(grade);
    if (!evaDoc.evaCollection) {
      return [];
    }

    // Filter eva items by course list when course list is given.
    if (courseList && courseList.length !== 0) {
      const courses = courseList.replace(/ +/g, '').split(',');
      evaDoc.evaCollection.forEach(collectionItem => {
        collectionItem.evaItems = collectionItem.evaItems.filter(evaItem => _.contains(courses, evaItem.course.replace(/ +/g, '')));
      });
    }

    // Remove collection items with empty EVA list. Sort remaining items by epoch in descending order.
    evaDoc.evaCollection = evaDoc.evaCollection
      .filter(collectionItem => collectionItem.evaItems.length > 0)
      .sort((collectionItemA, collectionItemB) => collectionItemB.epoch - collectionItemA.epoch);

    return evaDoc.evaCollection;
  }
}

module.exports = EvaService;
