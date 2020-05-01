const dateTime = require('date-and-time');

let instance;

/**
 * Configuration properties.
 * @property {Number} cacheTTL - Cache TTL, defaults to 15 minutes when env. variable TTL unset.
 * @property {String[]} grades - List of grades known to the app.
 * @property {String[]} upperGrades - List of upper grades.
 * @property {Map} upsMap - User-provided-services credentials map.
 * @property {Object} cloudantVCAP - Cloudant VCAP information from VCAP_SERVICES.
 * @property {String} apiKey - SHA1 hash value of API key.
 * @property {Date} simDate - Available in debug mode only, first date of substitution schedule will be set to this date.
 * @property {String} debugSchedulesDbDocId - In debug mode the schedules doc to use
 */
class Config {
  constructor() {
    if (!instance) {
      this.port = process.env.PORT || 3000;
      this.piusBaseUrl = 'https://pius-gymnasium.de';
      this.baseUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/`;

      this.debug = {
        simDate: null,
        debugSchedulesDbDocId: undefined,
      };

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
    const { apikey } = Config.upsMap.get('self');
    return apikey;
  }

  static get cloudantVCAP() {
    const cloudantServiceName = process.env.CLOUDANT_SERVICE_NAME;
    const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
    const cloudantVCAPList = vcapServices[cloudantServiceName] || [];
    return cloudantVCAPList[0];
  }

  /**
   * Gets simulated date. In production environment this will return always null.
   * @returns {Date}
   */
  get simDate() {
    return this.debug.simDate;
  }

  /**
   * Sets simulated date from given value whihc has format YYYYMMDD.
   * {String} value - Date to set.
   * @throws {Error} If value cannot be converted to Date.
   */
  set simDate(value) {
    if (dateTime.isValid(value, 'YYYYMMDD')) {
      this.debug.simDate = dateTime.parse(value, 'YYYYMMDD');
    } else {
      throw new Error('Invalid Date');
    }
  }

  /**
   * Gets the document id to use for reads from debug-schedules db. This
   * setting is in effect only in dev. environments. When not set it
   * is undefined.
   */
  get debugSchedulesDbDocId() {
    return this.debug.debugSchedulesDbDocId;
  }

  /**
   * Sets debug-schedules db document id to use.
   * {String} value - Id to be used.
   */
  set debugSchedulesDbDocId(value) {
    this.debug.debugSchedulesDbDocId = value;
  }
}

module.exports = Config;
