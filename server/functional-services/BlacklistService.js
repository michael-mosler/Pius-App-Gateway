const { Credential, BlacklistedCredentialsDb } = require('../providers/BlacklistedCredentialsDb');

/**
 * Implements all methods that are needed for blacklist management.
 */
class BlacklistService {
  constructor() {
    this.blacklistCredentialsDb = new BlacklistedCredentialsDb();
  }

  /**
   * Checks with given user/password combination of credentials are blacklisted. Use isBlacklisted property of returned
   * document to check for actual blacklisting.
   * @param {String} userId User to check for blacklisting.
   * @param {String} pwd Password of user to check for blacklisting.
   * @returns {Promise<Credential|Error>} When blacklisted document from blacklist-credentials DB
   */
  async checkBlacklisted(userId, pwd) {
    const credential = new Credential({ userId, pwd });
    return this.blacklistCredentialsDb.get(credential);
  }

  /**
   * Adds credential to blacklist-credentials DB. Credentially usually is the one that
   * has been returned by checkBlacklisted(). In case credential initially is not
   * blacklisted but 401 is received from backend the available credential can be
   * passed in directly.
   * @param {Credential} credential Add or update document to/in blacklist-credentials DB.
   * @returns {Promise<Object|Error>}
   */
  async blacklist(credential) {
    return this.blacklistCredentialsDb.insertDocument(credential);
  }

  /**
   * Delists a credential. In case of success or if credential is not blacklisted method
   * returns resolved promise. Otherwise it will return a rejected promise.
   * @param {String} userId User to delist.
   * @param {String} pwd Password to delist.
   * @returns {Promise<*|Error>} Resolves in case of success; value is not of any use.
   */
  async delist(userId, pwd) {
    let resolver;
    const credential = new Credential({ userId, pwd });
    const doc = await this.blacklistCredentialsDb.get(credential);
    if (doc.isBlacklisted) {
      resolver = await this.blacklistCredentialsDb.destroy(doc);
    }
    return resolver;
  }
}

module.exports = BlacklistService;
