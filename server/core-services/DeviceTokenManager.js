const CloudantDb = require('./CloudantDb');
const sha1 = require('sha1');
const LogService = require('../helper/LogService');
const Config = require('./Config');

class DeviceTokenManager {
  constructor() {
    this.logService = new LogService();
    this.deviceTokensDb = new CloudantDb('device-tokens', true);
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

    this.logService.logger.info(`Updating device token ${deviceToken} for messaging provider ${messagingProvider} with grade ${grade} and course list [${courseList}]`);

    this.deviceTokensDb.get(deviceToken)
      .then(document => Object.assign(document, { _id: deviceToken, grade, courseList, messagingProvider, version }))
      .then(newDocument => this.deviceTokensDb.insertDocument(newDocument))
      .then(() => res.status(200).end())
      .catch((err) => {
        this.logService.logger.error(`${err}\n`);
        res.status(500).end();
      });
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
        .catch((err) => {
          this.logService.logger.error(`Destroying failed device tokens failed with rejected promise: ${err}\n`);
          resolve();
        });
    });
  }
}

module.exports = DeviceTokenManager;
