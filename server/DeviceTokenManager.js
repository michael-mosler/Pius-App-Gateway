const CloudantDb = require('./CloudantDb');
const Config = require('./Config');

class DeviceTokemManager {
  constructor() {
    this.deviceTokensDb = new CloudantDb('device-tokens', true);
  }

  /**
   * Register a device token. If the token already exists it is updated otherwise it is created.
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  registerDeviceToken(req, res) {
    if (req.body.apiKey !== Config.apiKey) {
      res.status(401).end();
      return;
    }

    const deviceToken = req.body.deviceToken;
    const grade = req.body.grade;
    const courseList = req.body.courseList;
    console.log(`Updating device token ${deviceToken} with grade ${grade} and course list ${courseList}`);

    this.deviceTokensDb.get(deviceToken)
      .then(document => Object.assign(document, { _id: deviceToken, grade, courseList }))
      .then(newDocument => this.deviceTokensDb.insertDocument(newDocument))
      .then(() => res.status(200).end())
      .catch((err) => {
        console.log(`${err}\n`);
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
        console.log(`Will remove ${item.deviceToken}. Reason: ${item.reason}`);
        promises.push(this.deviceTokensDb.destroy({ _id: item.deviceToken, _rev: item._rev }));
      });

      Promise.all(promises)
        .then(() => resolve())
        .catch((err) => {
          console.log(`Destroying failed device tokens failed with rejected promise: ${err}\n`);
          resolve();
        });
    });
  }
}

module.exports = DeviceTokemManager;