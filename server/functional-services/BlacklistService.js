const { Credential, BlacklistedCredentialsDb } = require('../providers/BlacklistedCredentialsDb');

/**
 * Implements all methods that are needed for blacklist management.
 */
class BlacklistCredentialsService {
  constructor() {
    this.blacklistCredentialsDb = new BlacklistedCredentialsDb();
  }

  /**
   * Checks with given user/password combination of credentials are blacklisted. Use isBlacklisted property of returned
   * document to check for actual blacklisting.
   * @param {String} userId User to check for blacklisting.
   * @param {String} pwd Password of user to check for blacklisting.
   * @returns {Credential} When blacklisted document from blacklist-credentials DB
   * @throws {Error}
   */
  async checkBlacklisted(userId, pwd) {
    const credential = new Credential({ userId, pwd });
    return this.blacklistCredentialsDb.get(credential);
  }

  /**
   * Adds or updates document in blacklist-credentials DB. If the document already exists timestamp
   * is updated. This can be used to block credential only for a certain amount of time after
   * last unsuccessful access.
   * @param {Credential} credential Add or update document to/in blacklist-credentials DB.
   * @throws {Error}
   */
  async blacklist(credential) {
    await this.blacklistCredentialsDb.insertDocument(credential);
  }
}

module.exports = BlacklistCredentialsService;
