const CloudantDb = require('./CloudantDb');

class DeviceTokemManager {
  constructor() {
    this.deviceTokensDb = new CloudantDb('device-tokens', true);

    // Will be put into key store.
    this.apiKey = 'heSXxSOvNcl8J4UB9$#TV9TUZ3zClbX$EyOQzKiqGWxRgonzSe';
  }

  /**
   * Register a device token. If the token already exists it is updated otherwise it is created.
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  registerDeviceToken(req, res) {
    if (req.body.apiKey !== this.apiKey) {
      res.status(401).end();
      return;
    }

    const deviceToken = req.body.deviceToken;
    const grade = req.body.grade;
    console.log(`Updating device token ${deviceToken} with grade ${grade}`);

    this.deviceTokensDb.get(deviceToken)
      .then(document => Object.assign(document, { _id: deviceToken, grade }))
      .then(newDocument => this.deviceTokensDb.insertDocument(newDocument))
      .then(() => res.status(200).end())
      .catch((err) => {
        process.stderr.write(`${err}\n`);
        res.status(500).end();
      });
  }
}

module.exports = DeviceTokemManager;
