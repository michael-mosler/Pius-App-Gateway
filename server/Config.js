let instance;

class Config {
  constructor() {
    if (!instance) {
      this.port = process.env.PORT || 3000;
      this.piusBaseUrl = 'http://pius-gymnasium.de';
      this.baseUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/`;

      instance = this;
    }

    return instance;
  }

  static get grades() {
    return [
      '5A', '5B', '5C', '5D', '5E',
      '6A', '6B', '6C', '6D', '6E',
      '7A', '7B', '7C', '7D', '7E',
      '8A', '8B', '8C', '8D', '8E',
      '9A', '9B', '9C', '9D', '9E',
      'EF', 'Q1', 'Q2',
      'IKD', 'IKE',
    ];
  }

  static get upperGrades() {
    return ['EF', 'Q1', 'Q2'];
  }

  static get upsMap() {
    const upsMap = new Map();
    const vcapServices = JSON.parse(process.env.VCAP_SERVICES);

    if (vcapServices['user-provided']) {
      vcapServices['user-provided'].forEach(item => upsMap.set(item.name, item.credentials));
    }
    return upsMap;
  }

  static get apiKey() {
    return 'heSXxSOvNcl8J4UB9$#TV9TUZ3zClbX$EyOQzKiqGWxRgonzSe';
  }
}

module.exports = Config;
