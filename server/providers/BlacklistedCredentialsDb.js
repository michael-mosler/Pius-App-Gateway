const sha1 = require('sha1');
const CloudantDb = require('../core-services/CloudantDb');
const LogService = require('../helper/LogService');

/**
 * Define documents from blacklisted-credentials DB. These documents do not hold real user/password
 * information but SHA1 hashed values as _id.
 * @property {String} _id SHA1 hash of blacklisted credentials
 * @property {String} _rev Cloudant revision id
 * @property {String} timestamp Timestamp of last update.
 * @property {Boolean} isBlacklisted True when credentials are blacklisted.
 */
class Credential {
  constructor({ userId = null, pwd = null, doc = null }) {
    const { _id, _rev, timestamp } = doc || { };
    this._id = _id || ((userId && pwd) ? sha1(userId + pwd) : sha1('<<<null>>>'));
    this._rev = _rev;
    this.timestamp = timestamp;
  }

  get id() {
    return this._id;
  }

  get rev() {
    return this._rev;
  }

  get isBlacklisted() {
    return !!(this.rev);
  }
}

/**
 * The blacklisted-credentials DB holds SHA1 values of user/password combinations
 * which are known to be invalid. These can be used to avoid repeated 403 statuses
 * from backend.
 */
class BlacklistedCredentialsDb extends CloudantDb {
  constructor() {
    super('blacklisted-credentials', true);
    this.logService = new LogService();
  }

  /**
   * Gets document with id from the given input document.
   * @param {Credential|String} credential Document which has at least id property set.
   * @returns {Promise<Credential|Error>} Document from DB for given input document id. Use isBlacklisted property to check for actual blacklisting.
   */
  async get(credential) {
    if (typeof credential === 'string') {
      // Get credential with input string.
      const _doc = await super.get(credential);
      return new Credential({ doc: _doc });
    } else if (typeof credential === 'object' && credential.constructor.name === 'Credential') {
      // Get credential from object. In case nothing is found make sure that our key is kept.
      const _doc = await super.get(credential.id);
      Object.assign(_doc, { _id: credential.id });
      return new Credential({ doc: _doc });
    } else {
      throw new Error('unexpected type or class');
    }
  }
}

module.exports = { Credential, BlacklistedCredentialsDb };
