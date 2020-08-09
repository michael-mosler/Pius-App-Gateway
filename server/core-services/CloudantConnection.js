const cloudant = require('@cloudant/cloudant');
const VError = require('verror');
const Config = require('./Config');

/**
 * Cloudant  connection class. This class knows how to establish a physical connection to Cloudant.
 * Connection is not established on instantiation. You have to call connect() method to establish
 * the connection.
 * This class is not intended for common in the middleware but is intended to be used by database
 * drivers.
 * @property {String) dbURL - URL of Cloudant connection
 * @property {String) type - Type of connection: "Cloudant Connection"
 * @property {String} host - Cloudant service host name
 * @property {String} url - Cloudant service URL, includes credentials, aka basic auth. credentials
 * @property {String} apiKey - Cloudant service API key
 */
let instance;

class CloudantConnection {
  constructor() {
    if (!instance) {
      this.instanceName = 'Cloudant';
      this.instanceOffering = 'Lite';
      this.cloudant = null;

      instance = this;
    }

    return instance;
  }

  // noinspection JSMethodCanBeStatic
  /**
   * Gets type of this connection.
   * @returns {string} - Type of connection
   */
  // eslint-disable-next-line class-methods-use-this
  get type() {
    return 'Cloudant Connection';
  }

  /**
   * Gets a named property from Cloudant VCAP credentials record.
   * @param {String} property Property to get from VCAP record.
   * @returns {String} Property value
   * @throws {verror}
   * @private
   */
  static getVcapProperty(property) {
    try {
      const cloudantVCAP = Config.cloudantVCAP;
      const { credentials } = cloudantVCAP;
      const value = credentials[property];
      return value;
    } catch (err) {
      const verror = new VError({
        name: 'Database Connection Config Error',
        cause: err,
        info: {
          property,
        },
      }, `Could not get property ${property} from Cloudant VCAP data`);
      throw verror;
    }
  }

  static get host() {
    return CloudantConnection.getVcapProperty('host');
  }

  static get url() {
    return CloudantConnection.getVcapProperty('url');
  }

  static get apiKey() {
    return CloudantConnection.getVcapProperty('apikey');
  }

  /**
   * Establish connection to a CloudantDB instance.
   * @returns {Object}
   * @throws {verror}
   */
  connect() {
    if (!this.cloudant) {
      try {
        const url = CloudantConnection.url;
        this.cloudant = cloudant(url);
      } catch (err) {
        const verror = new VError({
          name: 'DatabaseConnectionError',
          cause: err,
          info: {
            instanceName: this.instanceName,
            instanceOffering: this.instanceOffering,
          },
        }, 'Failed to connect to CloudantDB');
        throw verror;
      }
    }

    return this.cloudant;
  }
}

module.exports = CloudantConnection;
