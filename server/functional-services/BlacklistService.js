const LogService = require('../helper/LogService');
const { Credential, BlacklistedCredentialsDb } = require('../providers/BlacklistedCredentialsDb');
const DeviceTokenManger = require('../core-services/DeviceTokenManager');

/**
 * Implements all methods that are needed for blacklist management.
 */
class BlacklistService {
  constructor() {
    this.logService = new LogService();
    this.blacklistedCredentialsDb = new BlacklistedCredentialsDb();
  }

  /**
   * Checks with given user/password combination of credentials are blacklisted. Use isBlacklisted property of returned
   * document to check for actual blacklisting.
   * @param {String} userId User to check for blacklisting.
   * @param {String} pwd Password of user to check for blacklisting.
   * @returns {Promise<Credential|Error>} When blacklisted document from blacklist-credentials DB
   */
  async getCredential(userId, pwd) {
    const credential = new Credential({ userId, pwd });
    return this.blacklistedCredentialsDb.get(credential);
  }

  /**
   * Checks if credential is blacklisted.
   * @param {String} credential to check for blacklisting
   * @returns {Promise<Boolean|Error>} Resolves to true when blacklisted.
   */
  async isBlacklisted(credential) {
    return (await this.blacklistedCredentialsDb.get(credential)).isBlacklisted;
  }

  /**
   * Adds credential to blacklist-credentials DB. Credentially usually is the one that
   * has been returned by getCredential(). In case credential initially is not
   * blacklisted but 401 is received from backend the available credential can be
   * passed in directly.
   * @param {Credential} credential Add or update document to/in blacklist-credentials DB.
   * @returns {Promise<Object|Error>}
   */
  async blacklist(credential) {
    const deviceTokenManager = new DeviceTokenManger('v2');
    const device = await deviceTokenManager.getDeviceTokens({ forCredential: credential.id });

    if (device.docs.length === 1) {
      this.logService.logger.info(`BlacklistService: Will delete token ${device.docs[0]._id} for credential ${credential.id}`);
      await deviceTokenManager.destroy(device.docs[0]);
    } else if (device.docs.length > 1) {
      this.logService.logger.error(`BlacklistService: Credential is not distinctly assigned to one device. Will not delete affected device tokens. Credential: ${credential.id}`);
    }

    return this.blacklistedCredentialsDb.insertDocument(credential);
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
    const doc = await this.blacklistedCredentialsDb.get(credential);
    if (doc.isBlacklisted) {
      resolver = await this.blacklistedCredentialsDb.destroy(doc);
    }
    return resolver;
  }
}

module.exports = BlacklistService;
