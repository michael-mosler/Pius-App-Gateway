const CloudantDb = require('./CloudantDb');

class DeviceTokemManager {
  constructor() {
    this.deviceTokensDb = new CloudantDb('device-tokens', true);

    // Will be put into key store.
    this.secret = 'heSXxSOvNcl8J4UB9$#TV9TUZ3zClbX$EyOQzKiqGWxRgonzSe';
  }

  addDeviceToken(req, res) {
    if (req.body.secret !== this.secret) {
      res.status(401).end();
      return;
    }

    const deviceToken = req.body.deviceToken;
    process.stdout.write(`Adding device token ${deviceToken}\n`);

    this.deviceTokensDb.insertDocument({ _id: deviceToken, grade: null })
      .then(() => res.status(200))
      .catch((err) => {
        process.stderr.write(`${err}\n`);
        res.status(500).end();
      });
  }
}

module.exports = DeviceTokemManager;
