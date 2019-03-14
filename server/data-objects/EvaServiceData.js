const _ = require('underscore');
const uuid = require('uuid/v1');
const datetime = require('date-and-time');

/**
 * EVA hsitory payload item. As items a storey by grade + course both are
 * not members of the payload.
 * @property {String} date - Format "Day of Week, DD.MM.YYYY"
 * @property {String} course - Course with EVA
 * @property {String} evaText - EVA text
 * @property {Number} epoch - Date as epoch
 */
class EvaItem {
  /**
   * @param {String} uuid
   * @param {String} course
   * @param {String} evaText
   */
  constructor(course, evaText) {
    this.uuid = uuid();
    this.course = course.trim();
    this.evaText = evaText.trim();
  }
}

/**
 * This class collects {@link EvaItem} instances for a certain date.
 * @property {String} date - Date the collection is for
 * @property {EvaItem[]} evaItems - List of EVA items for date
 * @property {Number} epoch - Date as epoch
 */
class EvaCollectionItem {
  /**
   * @param {String} date - Date this collection of EVA items is for
   * @param {EvaItem[]} evaItems - EVA items for date
   */
  constructor(date, evaItems) {
    this.date = date;
    this.epoch = EvaCollectionItem.toEpoch(date);
    this.evaItems = evaItems;
  }

  /**
   * Converts date string to epoch, time of day is set to 00:00h in UTC.
   * @param {String} date - Date string to convert, format must be e.g. 'Freitag, 01.02.2019'
   * @returns {Number} Epoch for the given date string in UTC
   * @throws {Error} When date string cannot be converted
   * @static
   */
  static toEpoch(date) {
    // Extract pure date from the given string. When patten is not found
    // date cannot be processed, throw an error. Epoch is taken from
    // UTC time.
    const matches = date.match(/\d{2}\.\d{2}\.\d{4}/);

    if (!matches) {
      throw new Error(`Invalid date format in string "${date}"`);
    }

    return (datetime.parse(`${matches[0]}`, 'DD.MM.YYYY', true)).getTime() / 1000;
  }
}

/**
 * This class defines the JSON document that is stored in EVA database.
 * @property {String} _id - Database document id
 * @property {String} _rev - Database document revision
 * @property {EvaCollectionItem[]} evaCollection - All EVA information for all dates sorted by epoch
 * @property {Date} timestamp - Document timestamp
 */
class EvaDoc {
  /**
   * Instantiates a new EvaDoc.
   * @param {Object} params - Object to instantiate new instance from.
   */
  constructor(params) {
    const properties = _.extend({ _id: null, _rev: null, evaCollection: [], timestamp: null, hash: null }, params);
    this._id = properties._id;
    if (properties._rev) {
      this._rev = properties._rev;
    }
    this.evaCollection = properties.evaCollection;
    this.timestamp = properties.timestamp;
    this.hash = properties.hash;
  }

  /**
   * Check if a collection item is already contained in list.
   * @param {EvaCollectionItem} newEvaCollectionItem - The item which existence shall be checked.
   * @returns {Boolean} true when item is contained in doc already
   * @private
   */
  contains(newEvaCollectionItem) {
    // Find EVA collection for the same epoch as newEvaCollectionItem and compute difference
    // in EVA items. When there is none this EVA doc is supposed to contain the
    // new collection already,
    const evaCollectionItem = this.evaCollection.find(evaCollectionItem => evaCollectionItem.epoch === newEvaCollectionItem.epoch);

    // New entry for the date of newEvaCollectionItem.
    if (!evaCollectionItem) {
      return false;
    }

    // Found, is the new collection item equal to the already recorded one, i.e. are all eva items the same?
    // This true if |list1 intersect list2| === 0.
    const newEvaItems = newEvaCollectionItem.evaItems.map(item => ({ course: item.course, evaText: item.evaText }));
    let diff1 = _.reject(
      evaCollectionItem.evaItems.map(item => ({ course: item.course, evaText: item.evaText })),
      evaItem1 => _.find(newEvaItems, evaItem2 => evaItem1.course === evaItem2.course && evaItem1.evaText === evaItem2.evaText)
    );

    let diff2 = _.reject(
      newEvaItems.map(item => ({ course: item.course, evaText: item.evaText })),
      evaItem1 => _.find(evaCollectionItem.evaItems, evaItem2 => evaItem1.course === evaItem2.course && evaItem1.evaText === evaItem2.evaText)
    );

    // Yes it is when difference of both eva item lists is empty.
    return diff1.length + diff2.length === 0;
  }

  /**
   * Merge collection into document. When collection for the same epoch already exists
   * it is replaced otherwise collection is added to document. Operation is unconditionally,
   * thus check with contains if merge is needed. When a new date is added eva collection
   * finally is sliced to 10 entries.
   * @param {EvaCollectionItem} newEvaCollectionItem - Item to merge into doc.
   * @returns {EvaDoc} Updated doc.
   */
  merge(newEvaCollectionItem) {
    const index = _.sortedIndex(this.evaCollection, newEvaCollectionItem, 'epoch');
    const collectionItemAtIndex = this.evaCollection[index] || { };
    const { epoch: epochAtIndex = -1 } = collectionItemAtIndex;

    // Same date replace otherwise insert
    if (epochAtIndex === newEvaCollectionItem.epoch) {
      let newEvaItems = _.values(_.extend(_.indexBy(this.evaCollection[index].evaItems, 'course'), _.indexBy(newEvaCollectionItem.evaItems, 'course')));
      newEvaItems = newEvaItems.sort((a, b) => ((a.course < b.course) ? -1 : 1));
      this.evaCollection[index].evaItems = newEvaItems;
    } else {
      let newEvaCollection = this.evaCollection;
      newEvaCollection.splice(index, 0, newEvaCollectionItem);
      newEvaCollection = newEvaCollection.slice(-10);
      this.evaCollection = newEvaCollection;
    }

    return this;
  }
}

module.exports = { EvaItem, EvaCollectionItem, EvaDoc };
