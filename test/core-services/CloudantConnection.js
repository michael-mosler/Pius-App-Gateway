const expect = require('expect');
const td = require('testdouble');

describe('CloudantConnection VCAP Access', () => {
  const vcapJSON = '{ "credentials": { "apikey": "XXXXX", "host": "HHHHH", "url": "UUUUU" } }';
  const vcap = JSON.parse(vcapJSON);
  let Config;

  beforeEach(() => {
    Config = td.replace('../../server/core-services/Config');
  });

  it('should get properties', () => {
    const CloudantConnection = require('../../server/core-services/CloudantConnection');
    Config.cloudantVCAP = vcap;
    expect(CloudantConnection.host).toMatch('HHHHH');
    expect(CloudantConnection.apiKey).toMatch('XXXXX');
    expect(CloudantConnection.url).toMatch('UUUUU');
  });

  it('should fail on error', () => {
    const CloudantConnection = require('../../server/core-services/CloudantConnection');
    Config.cloudantVCAP = undefined;
    // eslint-disable-next-line no-unused-vars
    expect(() => { const _ = CloudantConnection.host; }).toThrow();
    // eslint-disable-next-line no-unused-vars
    expect(() => { const _ = CloudantConnection.url; }).toThrow();
    // eslint-disable-next-line no-unused-vars
    expect(() => { const _ = CloudantConnection.apiKey; }).toThrow();
  });
});
