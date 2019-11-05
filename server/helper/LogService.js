const winston = require('winston');
const { combine, timestamp, colorize, align, printf } = winston.format;

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
 */
class LogService {
  constructor() {
    if (!self) {
      let transports;

      const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL || 'info';
      const fileLogLevel = process.env.FILE_LOG_LEVEL || 'error';

      if (process.env.NODE_ENV === 'production') {
        transports = [
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
      } else {
        transports = [
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
      }

      this.winston = winston.createLogger({
        transports,
      });

      self = this;
    }

    return self;
  }

  get logger() {
    return this.winston;
  }
}

module.exports = LogService;
