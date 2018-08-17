const Config = require('./Config');

class BasicAuthProvider {
  constructor() {
    const credentials = Config.upsMap.get('pius-vertretungsplan-service');
    this.username = credentials.username;
    this.password = credentials.password;
  }

  getAuthInfo() {
    const authInfo = Buffer.from(this.username + ':' + this.password).toString('base64');

    // Gettung username and password from key store will be asynchronous.
    return Promise.resolve(authInfo);
  }
}

module.exports = BasicAuthProvider;
