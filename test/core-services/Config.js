const expect = require('expect');
const dateTime = require('date-and-time');
const Config = require('../../server/core-services/Config');

describe('Config.cloudantVCAP', () => {
  beforeEach(() => {
    process.env.VCAP_SERVICES = '{ "cloudant": [ { "credentials": { "apikey": "XXXXX", "host": "HHHHH" } } ] }';
  });

  afterEach(() => {
    process.env.CLOUDANT_SERVICE_NAME = undefined;
    process.env.VCAP_SERVICES = undefined;
  });

  it('should return VCAP info for service name', () => {
    process.env.CLOUDANT_SERVICE_NAME = 'cloudant';
    const vcap = Config.cloudantVCAP;
    expect(vcap.credentials.apikey).toEqual('XXXXX');
  });

  it('should return undefined info for unknown service name', () => {
    process.env.CLOUDANT_SERVICE_NAME = 'couch';
    const vcap = Config.cloudantVCAP;
    expect(vcap).toBeUndefined();
  });

  it('should throw in JSON parse error', () => {
    process.env.CLOUDANT_SERVICE_NAME = 'couch';
    process.env.VCAP_SERVICES = '{ "cloudant": [ { "credentials": { "apikey": "XXXXX", "host": "HHHHH" } } ]';

    try {
      // eslint-disable-next-line no-unused-vars
      const _ = Config.cloudantVCAP;
      expect(false).toBeTruthy();
    } catch (err) { }
  });
});

describe('Config.simDate', () => {
  it('should simdate correctly', () => {
    const config = new Config();
    config.simDate = '20200321';
    const simDate = config.simDate;
    expect(dateTime.format(simDate, 'YYYYMMDD')).toEqual('20200321');
  });

  it('should throw on unexpected format', () => {
    const config = new Config();
    try {
      config.simDate = '20321';
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual('Invalid Date');
    }

    try {
      config.simDate = 'AABBCC';
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual('Invalid Date');
    }

    try {
      config.simDate = '20200230';
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual('Invalid Date');
    }
  });
});
