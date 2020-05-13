const td = require('testdouble');
const expect = require('expect');

describe('HtmlLoader', () => {
  let request;

  beforeEach(() => {
    request = td.replace('request');
  });

  afterEach(() => {
    td.reset();
  });

  it('should load page', async () => {
    td.when(request({ method: 'get', url: '/someurl' }, td.callback))
      .thenCallback(null, { statusCode: 200 }, 'data');

    const { HtmlLoader } = require('../../server/core-services/HtmlLoader');
    const htmlLoader = new HtmlLoader('/someurl');
    await expect(htmlLoader.load()).resolves.toBe('data');
  });

  it('should throw on error', async () => {
    td.when(request({ method: 'get', url: '/someurl' }, td.callback))
      .thenCallback(new Error('Failed'), { statusCode: 500 }, null);

    const { HtmlLoader } = require('../../server/core-services/HtmlLoader');
    const htmlLoader = new HtmlLoader('/someurl');
    await expect(htmlLoader.load()).rejects.toThrow();
  });

  it('should throw on exception', async () => {
    td.when(request({ method: 'get', url: '/someurl' }, td.callback))
      .thenThrow(new Error('Failed'));

    const { HtmlLoader } = require('../../server/core-services/HtmlLoader');
    const htmlLoader = new HtmlLoader('/someurl');
    await expect(htmlLoader.load()).rejects.toThrow();
  });
});
