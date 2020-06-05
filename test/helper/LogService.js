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
    process.env.VCAP_SERVICES = '{ "cloudantNoSQLDB": [ { "credentials": { "apikey": "key", "host": "1-bluemix.cloudant.com", "iam_apikey_description": "Auto generated apikey during resource-bind operation for Instance - crn:v1:bluemix:public:cloudantnosqldb", "iam_apikey_name": "auto-generated-apikey", "iam_role_crn": "crn:v1:bluemix:public:iam::::serviceRole:Role", "iam_serviceid_crn": "crn:v1:bluemix:public:iam-identity::a/279f1e9", "password": "secret", "port": 443, "url": "https://1-bluemix:secret@1-bluemix.cloudant.com", "username": "1-bluemix" }, "label": "cloudantNoSQLDB", "name": "Cloudant", "plan": "Lite", "provider": null, "syslog_drain_url": null, "tags": [ "data_management", "ibm_created", "lite", "ibm_dedicated_public", "ibmcloud-alias" ], "volume_mounts": [] } ], "user-provided": [ ] }';
    process.env.VCAP_APPLICATION = '{ "application_name": "my-app" }';
    process.env.CLOUDANT_SERVICE_NAME = 'cloudantNoSQLDB';

    td.when(WinstonCloudant.prototype.constructor(td.matchers.not({
      level: 'error',
      url: 'https://1-bluemix.cloudant.com',
      iamApiKey: 'key',
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
    process.env.VCAP_SERVICES = '{ "cloudantNoSQLDB": [ { "credentials": { "apikey": "key", "host": "1-bluemix.cloudant.com", "iam_apikey_description": "Auto generated apikey during resource-bind operation for Instance - crn:v1:bluemix:public:cloudantnosqldb", "iam_apikey_name": "auto-generated-apikey", "iam_role_crn": "crn:v1:bluemix:public:iam::::serviceRole:Role", "iam_serviceid_crn": "crn:v1:bluemix:public:iam-identity::a/279f1e9", "password": "secret", "port": 443, "url": "https://1-bluemix:secret@1-bluemix.cloudant.com", "username": "1-bluemix" }, "label": "cloudantNoSQLDB", "name": "Cloudant", "plan": "Lite", "provider": null, "syslog_drain_url": null, "tags": [ "data_management", "ibm_created", "lite", "ibm_dedicated_public", "ibmcloud-alias" ], "volume_mounts": [] } ], "user-provided": [ ] }';
    process.env.VCAP_APPLICATION = '{ "application_name": "my-app" }';
    process.env.CLOUDANT_SERVICE_NAME = 'cloudantNoSQLDB';

    td.when(WinstonCloudant.prototype.constructor(td.matchers.not({
      level: 'error',
      url: 'https://1-bluemix.cloudant.com',
      iamApiKey: 'key',
      db: 'combined-log',
    })))
      .thenThrow(new Error('unexpected parameters in call to winston-cloudant constructor'));

    td.when(winston.createLogger(td.matchers.isA(Object)))
      .thenDo(options => {
        expect(options.transports.length).toEqual(1);
        return td.object(['debug', 'info', 'warn', 'error']);
      });

    // eslint-disable-next-line no-unused-vars
    const _ = new LogService();
  });
});
