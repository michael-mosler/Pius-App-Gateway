const CloudantDb = require('../core-services/CloudantDb');

/**
 * Staff dictionary as it is stored in database "staff".
 * @property {String} _id - Constant value "staff"
 * @property {String} _rev - Cloudant revision
 * @property {Object} - Staff dictionary as returned by Staff.dictionary.
 */
class StaffDoc {
  constructor(rev = undefined, staffDictionary) {
    this._id = 'staff';
    this._rev = rev;
    this.staffDictionary = staffDictionary;
  }
}

/**
 * StaffDb from Cloudant backing store. This DB will hold one document of type
 * {StaffDoc}, only.
 * @extends {CloudantDb}
 */
class StaffDb extends CloudantDb {
  constructor() {
    super('staff', true);
  }

  /**
   * Get staff dictionary from staff database.
   * @returns {Promise<StaffDoc|Error>} - Staff document, when no document exists staff doc will "empty", i.e. dictionary is undefined.
   */
  async get() {
    const doc = await super.get('staff');
    const staffDoc = new StaffDoc(doc._rev, doc.staffDictionary);
    return staffDoc;
  }
}

module.exports = { StaffDoc, StaffDb };
