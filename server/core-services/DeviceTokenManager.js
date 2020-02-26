const sha1 = require('sha1');
const CloudantDb = require('./CloudantDb');
const LogService = require('../helper/LogService');
const Config = require('./Config');
const VertretungsplanHelper = require('../helper/VertretungsplanHelper');
const { BlacklistedCredentialsDb } = require('../providers/BlacklistedCredentialsDb');

/**
 * Manages registered device tokens from Android and iOS devices.
 * @property {Function} destroy Gives access to token db destroy function.
 */
class DeviceTokenManager {
  constructor(version = 'v1') {
    this.version = version;
    this.logService = new LogService();
    this.deviceTokensDb = new CloudantDb('device-tokens', true);
    this.destroy = this.deviceTokensDb.destroy;
    this.blacklistedCredentialsDb = new BlacklistedCredentialsDb();
  }

  /**
   * Checks if credential is blacklisted.
   * @param {String} credential to check for blacklisting
   * @returns {Promise<Boolean|Error>} Resolves to true when blacklisted.
   * @private
   */
  async isBlacklisted(credential) {
    return (await this.blacklistedCredentialsDb.get(credential)).isBlacklisted;
  }

  /**
   * Checks if given information is complete and, thus, register request can be
   * executed.
   * @param {String} grade Grade given with incoming register request.
   * @param {String} courseList Course list given with incoming register request.
   * @param {String} credential SHA1 hash of login credential (as of version v2)
   * @returns {Promise<Boolean|Error>} true if registration is possible, false otherwise.
   * @private
   */
  async canRegister(grade, courseList, credential) {
    let result = true;

    // v2 API version requires also credential to be set.
    // Starting from iOS app version 3.1 and Android version 1.4.2 this
    // API is being used.
    if (this.version === 'v2') {
      result = !!(credential) && credential.length > 0;
      result = result && !(await this.isBlacklisted(credential));
    }

    result = result && (
      // Grade given?
      (grade && !VertretungsplanHelper.isUpperGrade(grade) && grade.length > 0) ||
      // Upper grade then course list must bet set?
      (VertretungsplanHelper.isUpperGrade(grade) &&
        (courseList && courseList.length > 0)));

    return result;
  }

  /**
   * Deletes the given device token. If token does not exist function
   * returns with a resolved promise anyway. If an error occurs a
   * rejected promise with error information is returned.
   * @param {String} deviceToken Device token that is to be deleted.
   * @returns {Promise<*|Error>}
   * @private
   */
  async deleteDeviceToken(deviceToken) {
    try {
      const document = await this.deviceTokensDb.get(deviceToken);
      if (document._id) {
        return this.deviceTokensDb.destroy(document);
      } else {
        return Promise.resolve();
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Register a device token. If the token already exists it is updated otherwise it is created.
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  async registerDeviceToken(req, res) {
    if (sha1(req.body.apiKey) !== Config.apiKey) {
      res.status(401).end();
      return;
    }

    const { deviceToken, grade, courseList: _courseList = [], messagingProvider = 'apn', version = '', credential } = req.body;

    // Workaround for JSON creation error on Android. courseList is not sent as JSON array
    // but as string.
    let courseList;
    if (messagingProvider === 'fcm' && !Array.isArray(_courseList)) {
      courseList = [];
      _courseList || []
        .replace('[', '')
        .replace(']', '')
        .split(',')
        .forEach(item => courseList.push(item.trim()));
    } else {
      courseList = _courseList || [];
    }

    try {
      // Check if this token can be registered. If not and token exists then it will be deleted.
      // If deletion fails this error is logged but device receives status 200 anyway. There
      // it not much that can be done when deletion fails.
      if (await this.canRegister(grade, courseList, credential)) {
        this.logService.logger.info(`Updating device token ${deviceToken} for messaging provider ${messagingProvider} with grade ${grade} and course list [${courseList}]`);

        this.deviceTokensDb.get(deviceToken)
          .then(document => Object.assign(document, { _id: deviceToken, grade, courseList, messagingProvider, version, credential }))
          .then(newDocument => this.deviceTokensDb.insertDocument(newDocument))
          .then(() => res.status(200).end())
          .catch(err => {
            this.logService.logger.error(`Upserting device token ${deviceToken} failed: ${err}`);
            res.status(500).end();
          });
      } else {
        this.logService.logger.info(`Cannot register device token ${deviceToken} due to incomplete data or blacklisting. If token exists it will be deleted.`);
        this.deleteDeviceToken(deviceToken)
          .then(() => res.status(200).end())
          .catch(err => {
            this.logService.logger.error(`Deleting device token ${deviceToken} failed: ${err}`);
            res.status(500).end();
          });
      }
    } catch (err) {
      this.logService.logger.error(`Error in registration process for token ${deviceToken}: ${err}`);
      res.status(500).end();
    }
  }

  /**
   * Get all device token documents for a given grade.
   * @param {String} forGrade Grade for which token shall be returned.
   * @returns {Promise<Object|Error>} Resolves to a all matching documents from device-tokens DB.
   */
  async getDeviceTokens({ forGrade = null, forCredential = null }) {
    if (forGrade && forCredential) {
      throw new Error('DeviceTokenManager.getDeviceToken() must be called with only one of grade or credential');
    }

    if (forGrade) {
      return this.deviceTokensDb.find({ selector: { grade: forGrade } });
    }

    if (forCredential) {
      return this.deviceTokensDb.find({ selector: { credential: forCredential } });
    }

    throw new Error('DeviceTokenManager.getDeviceToken() must be called with at least one of grade or credential');
  }

  /**
   * Delete all token given in an array of documents from device-tokens DB.
   * @param {Object[]} failedList List of documents from device-tokens DB which have an invalid device token.
   * @returns {Promise} Promise that is always resolved when housekeeping is finished.
   */
  housekeeping(failedList) {
    return new Promise((resolve) => {
      const promises = [];

      failedList.forEach((item) => {
        this.logService.logger.warn(`Will remove ${item.deviceToken}. Reason: ${item.reason}`);
        promises.push(this.deviceTokensDb.destroy({ _id: item.deviceToken, _rev: item._rev }));
      });

      Promise.all(promises)
        .then(() => resolve())
        .catch(err => {
          this.logService.logger.error(`Deleting invalid device tokens failed: ${err}`);
          resolve();
        });
    });
  }
}

module.exports = DeviceTokenManager;
