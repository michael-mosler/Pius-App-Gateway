const winston = require('winston');
const { combine, timestamp, colorize, align, printf } = winston.format;
const CloudantTransport = require('winston-cloudant');
const CloudantConnection = require('../core-services/CloudantConnection');

let self;

/**
 * A new logger class based on Winston that takes care about
 * our particular needs in terms of transports and log format
 * depending on the environment the processes is running in.
 *
 * In production Console and backing store logging of errors
 * will be activated. Console loglevel is configurable. In
 * development only Console log will be added. Log level
 * again is configurable.
 *
 * @property {Object} logger Winston logger
 */
class LogService {
  constructor() {
    if (!self) {
      // We want to display application name as additional field in WinstonCloudant
      // transport. Get it from VCAP_APPLICATION.
      try {
        const vcapApplication = JSON.parse(process.env.VCAP_APPLICATION);
        const { application_name: applicationName } = vcapApplication;
        this.applicationName = applicationName;
      } catch (err) {
        this.applicationName = 'unset';
      }

      // There are different transports in production and develop.
      // In develop we do not log to file as it does not make any
      // sense when we can monitor console.
      const transports = (process.env.NODE_ENV === 'production') ? LogService.productionTransports() : LogService.developmentTransports();

      this.winston = winston.createLogger({ transports });
      this.winston.debug = LogService.customizeLogFunction(this, this.winston.debug);
      this.winston.info = LogService.customizeLogFunction(this, this.winston.info);
      this.winston.warn = LogService.customizeLogFunction(this, this.winston.warn);
      this.winston.error = LogService.customizeLogFunction(this, this.winston.error);

      self = this;
    }

    return self;
  }

  get logger() {
    return this.winston;
  }

  /**
   * Create Winston production transports.
   * @return {Array} Transports
   * @private
   */
  static productionTransports() {
    const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL || 'info';
    const fileLogLevel = process.env.FILE_LOG_LEVEL || 'error';
    const dbLogLevel = process.env.DB_LOG_LEVEL || 'error';
    const cloudantTransport = LogService.cloudantTransport(dbLogLevel);

    const transports = [
      new winston.transports.Console({
        level: consoleLogLevel,
        format: combine(
          printf(info => `${info.level}: ${info.message}`),
        ),
      }),
      new winston.transports.File({
        level: fileLogLevel,
        format: combine(
          timestamp(),
          colorize(),
          align(),
          printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
        ),
        filename: './logs/combined.log',
      }),
    ];

    // If cloudant transport was successfully created we
    // must add it to our list of transports.
    cloudantTransport && transports.push(cloudantTransport);
    return transports;
  }

  /**
   * Create Winston development transports.
   * @return {Array} transports
   * @private
   */
  static developmentTransports() {
    const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL || 'info';

    const transports = [
      new winston.transports.Console({
        level: consoleLogLevel,
        format: combine(
          timestamp(),
          colorize(),
          align(),
          printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
        ),
      }),
    ];

    // For debugging purposes we also may enable logging to DB in dev. env.
    if (process.env.DB_LOG_IN_DEV === 'true') {
      const dbLogLevel = process.env.DB_LOG_LEVEL || 'error';
      const cloudantTransport = LogService.cloudantTransport(dbLogLevel);
      cloudantTransport && transports.push(cloudantTransport);
    }

    return transports;
  }

  /**
   * Customize log function by adding custom fields.
   * @param {LogService} self LogService instance for which log functions shall be customized
   * @param {Function} f The function to customize
   * @returns {Function}
   * @private
   */
  static customizeLogFunction(self, f) {
    return (message, fields = {}) => f(message, Object.assign(fields, { appName: self.applicationName }));
  }

  /**
   * Try to create Cloudant transport. This may silently return null if transport cannot be
   * created.
   * @param {number} level Log level to use for transport
   * @return {Object} Cloudant transport, may be null if transport creation is not possible.
   * @private
   */
  static cloudantTransport(level) {
    try {
      return new CloudantTransport({
        level,
        url: `https://${CloudantConnection.host}`,
        iamApiKey: CloudantConnection.apiKey,
        db: 'combined-log',
      });
    } catch (err) {
      // There is not much we can do if we get an exception here.
      return null;
    }
  }
}

module.exports = LogService;
