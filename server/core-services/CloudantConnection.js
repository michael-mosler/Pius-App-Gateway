const cloudant = require('@cloudant/cloudant');
const VError = require('verror');

const LogService = require('../helper/LogService');

/**
 * Cloudant  connection class. This class knows how to establish a physical connection to Cloudant.
 * Connection is not established on instantiation. You have to call connect() method to establish
 * the connection.
 * This class is not intended for common in the middleware but is intended to be used by database
 * drivers.
 * @property {String) dbURL - URL of Cloudant connection
 * @property {String) type - Type of connection: "Cloudant Connection"
 */
class CloudantConnection {
  constructor() {
    this.logService = new LogService();
    this.instanceName = 'Cloudant';
    this.instanceOffering = 'Lite';
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
   * Establish connection to a CloudantDB instance.
   * @returns {Object}
   */
  connect() {
    try {
      return cloudant({ instanceName: this.instanceName, vcapServices: JSON.parse(process.env.VCAP_SERVICES) });
    } catch (err) {
      const verror = new VError({
        name: 'DatabaseConnectionError',
        cause: err,
        info: {
          instanceName: this.instanceName,
          instanceOffering: this.instanceOffering,
        },
      }, 'Failed to connect to CloudantDB');

      this.logService.logger.error(`${verror}\n`);
      throw verror;
    }
  }
}

module.exports = CloudantConnection;
