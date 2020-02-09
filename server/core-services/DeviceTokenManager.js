const sha1 = require('sha1');
const CloudantDb = require('./CloudantDb');
const LogService = require('../helper/LogService');
const Config = require('./Config');
const VertretungsplanHelper = require('../helper/VertretungsplanHelper');

/**
 * Manages registered device tokens from Android and iOS devices.
 */
class DeviceTokenManager {
  constructor() {
    this.logService = new LogService();
    this.deviceTokensDb = new CloudantDb('device-tokens', true);
  }

  /**
   * Checks if given information is complete and, thus, register request can be
   * executed.
   * @param {String} grade Grade given with incoming register request.
   * @param {String} courseList Course list given with incoming register request.
   * @returns {Boolean} true if registration is possible, false otherwise.
   * @private
   */
  canRegister(grade, courseList) {
    const result =
      // No grade given?
      (grade && !VertretungsplanHelper.isUpperGrade(grade) && grade.length > 0) ||
      // Upper grade but no course list?
      (VertretungsplanHelper.isUpperGrade(grade) &&
        (courseList && courseList.length > 0));

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
  registerDeviceToken(req, res) {
    if (sha1(req.body.apiKey) !== Config.apiKey) {
      res.status(401).end();
      return;
    }

    const { deviceToken, grade, courseList: _courseList = [], messagingProvider = 'apn', version = '' } = req.body;

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

    // Check if this token can be registered. If not and token exists then it will be deleted.
    // If deletion fails this error is logged but device receives status 200 anyway. There
    // it not much that can be done when deletion fails.
    if (this.canRegister(grade, courseList)) {
      this.logService.logger.info(`Updating device token ${deviceToken} for messaging provider ${messagingProvider} with grade ${grade} and course list [${courseList}]`);

      this.deviceTokensDb.get(deviceToken)
        .then(document => Object.assign(document, { _id: deviceToken, grade, courseList, messagingProvider, version }))
        .then(newDocument => this.deviceTokensDb.insertDocument(newDocument))
        .then(() => res.status(200).end())
        .catch(err => {
          this.logService.logger.error(`Upserting device token ${deviceToken} failed: ${err}`);
          res.status(500).end();
        });
    } else {
      this.logService.logger.info(`Cannot register device token ${deviceToken} due to incomplete data. Existing token will be deleted.`);
      this.deleteDeviceToken(deviceToken)
        .then(() => res.status(200).end())
        .catch(err => {
          this.logService.logger.error(`Deleting device token ${deviceToken} failed: ${err}`);
          res.status(500).end();
        });
    }
  }

  getDeviceTokens(forGrade) {
    return this.deviceTokensDb.find({ selector: { grade: forGrade } });
  }

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
