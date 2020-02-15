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
    this._id = _id || sha1((userId || '<none>') + (pwd || '<none>'));
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
   * @param {Credentials} credential Document which has at least id property set.
   * @returns {Credentials} Document from DB for given input document id. Use isBlacklisted property to check for actual blacklisting.
   * @throws {Error} Please note that data not found is not an error!
   */
  async get(credential) {
    const _doc = await super.get(credential.id);
    Object.assign(credential, _doc);
    return new Credential({ doc: credential });
  }
}

module.exports = { Credential, BlacklistedCredentialsDb };
