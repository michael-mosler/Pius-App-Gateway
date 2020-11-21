const expect = require('expect');
const td = require('testdouble');

describe('LogService', () => {
  let winston;
  let LogService;
  let WinstonCloudant;

  beforeEach(() => {
    winston = td.replace('winston');
    winston.format.timestamp = td.function();
    winston.format.colorize = td.function();
    winston.format.align = td.function();
    winston.format.printf = td.function();
    winston.format.label = td.function();
    winston.format.combine = td.function();
    winston.transports.Console = td.constructor();
    winston.transports.File = td.constructor();

    WinstonCloudant = td.replace('winston-cloudant');
    LogService = require('../../server/helper/LogService');
  });

  it('should instantiate correctly for production', () => {
    process.env.NODE_ENV = 'production';
    td.when(WinstonCloudant.prototype.constructor(td.matchers.not({
      level: 'error',
      url: 'https://HHHHH',
      iamApiKey: 'XXXXX',
      db: 'combined-log',
    })))
      .thenThrow(new Error('unexpected parameters in call to winston-cloudant constructor'));

    td.when(winston.createLogger(td.matchers.isA(Object)))
      .thenDo(options => {
        expect(options.transports.length).toEqual(3);
        return td.object(['debug', 'info', 'warn', 'error']);
      });

    // eslint-disable-next-line no-unused-vars
    const _ = new LogService();
  });

  it('should instantiate correctly for develop', () => {
    process.env.NODE_ENV = 'develop';
    td.when(WinstonCloudant.prototype.constructor(td.matchers.not({
      level: 'error',
      url: 'https://HHHH',
      iamApiKey: 'key',
      db: 'combined-log',
    })))
      .thenThrow(new Error('unexpected parameters in call to winston-cloudant constructor'));

    td.when(winston.createLogger(td.matchers.isA(Object)))
      .thenDo(options => {
        expect(options.transports.length).toEqual(2);
        return td.object(['debug', 'info', 'warn', 'error']);
      });

    // eslint-disable-next-line no-unused-vars
    const _ = new LogService();
  });
});
