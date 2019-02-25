let instance;

/**
 * Configuration properties.
 * @property {Number} cacheTTL - Cache TTL, defaults to 15 minutes when env. variable TTL unset.
 */
class Config {
  constructor() {
    if (!instance) {
      this.port = process.env.PORT || 3000;
      this.piusBaseUrl = 'https://pius-gymnasium.de';
      this.baseUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/`;

      instance = this;
    }

    return instance;
  }

  static get cacheTTL() {
    const ttl = process.env.TTL || 15; // Minutes
    if (isNaN(ttl)) {
      return 900000; // 15 Minutes by default
    }

    return ttl * 60 * 1000;
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

  /**
   * @returns {String} ISO Date and Time UTC format string.
   */
  static get isoUtcDateTime() {
    return 'YYYY-MM-DD\'T\'HH:MM:ss\'Z\'';
  }

  /**
   * @returns {String} ISO Date and Time format string.
   */
  static get isoDateTime() {
    return 'yyyy-mm-dd\'T\'HH:MM:ss';
  }
}

module.exports = Config;
