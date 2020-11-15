const expect = require('expect');
const td = require('testdouble');

describe('CloudantConnection VCAP Access', () => {
  const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
  const vcap = vcapServices.cloudant[0];
  let Config;

  beforeEach(() => {
    Config = td.replace('../../server/core-services/Config');
  });

  it('should get properties', () => {
    const CloudantConnection = require('../../server/core-services/CloudantConnection');
    Config.cloudantVCAP = vcap;
    expect(CloudantConnection.host).toMatch('HHHHH');
    expect(CloudantConnection.apiKey).toMatch('XXXXX');
    expect(CloudantConnection.url).toMatch('https://HHHHH');
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
