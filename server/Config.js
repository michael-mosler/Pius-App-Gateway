let instance;

class Config {
  constructor() {
    if (!instance) {
      this.port = process.env.PORT || 3000;
      this.piusBaseUrl = "http://pius-gymnasium.de";
      this.baseUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/`;

      instance = this;
    }

    return instance;
  }
}

module.exports = Config;
