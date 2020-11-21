const td = require('testdouble');
const expect = require('expect');
const datetime = require('date-and-time');
const clone = require('clone');

const result = {
  docs: [
    {
      _id: 'd7f2967ad0b2046ce7fbcf6605495500',
      _rev: '1-4b723f9afdbfea8fc8d2a02d5203cea9',
    },
    {
      _id: 'e60519101d28b4e3dd44b803c7c8335a',
      _rev: '1-efc6cc3291419926ba11d3185074fe6e',
    },
    {
      _id: 'c5f00f40bdbd3949e0a366f4d957a8cf',
      _rev: '1-98e20a47cdcf2b5329461d1e9b4d2b9e',
    },
  ],
};

describe('ExtendedWinstonCloudant', () => {
  let ExtendedWinstonCloudant;

  beforeEach(() => {
    td.replace('winston-cloudant');
    ExtendedWinstonCloudant = require('../../server/core-services/ExtendedWinstonCloudant');
  });

  it('should instantiate correctly', async () => {
    const extendedWinstonCloudant = new ExtendedWinstonCloudant({
      level: 'error',
      url: 'https://HHHHH',
      iamApiKey: 'XXXXX',
      db: 'combined-log',
      retention: 5,
      maxEvents: 1000,
    });

    expect(extendedWinstonCloudant.retention).toBe(5);
    expect(extendedWinstonCloudant.maxEvents).toBe(1000);
  });

  it('should delete outdated events', async () => {
    const extendedWinstonCloudant = new ExtendedWinstonCloudant({
      level: 'error',
      url: 'https://HHHHH',
      iamApiKey: 'XXXXX',
      db: 'combined-log',
      retention: 5,
      maxEvents: 1000,
    });

    // Expected filter date, we will check date part only.
    const now = new Date();
    const refDate = datetime.addDays(now, -5);
    const expectedFilterDate = datetime.format(refDate, 'YYYY-MM-DD[T]');

    extendedWinstonCloudant.db = td.object();
    extendedWinstonCloudant.db.find = td.function();
    extendedWinstonCloudant.db.destroy = td.function();

    td.when(extendedWinstonCloudant.db.find(td.matchers.isA(Object)))
      .thenDo(opts => {
        const filterDate = opts.selector['params.@timestamp'].$lt;
        expect(opts.fields).toEqual(['_id', '_rev']);
        expect(filterDate.substring(0, 11)).toEqual(expectedFilterDate);
        return Promise.resolve(result);
      });

    // Check if destroy is called for each document returned. We expect
    // each document to be found in resultCopy. If so then document gets
    // deleted. Finally resultCopy must contains 3 undefined values.
    const resultCopy = clone(result);
    td.when(extendedWinstonCloudant.db.destroy(td.matchers.isA(String), td.matchers.isA(String)))
      .thenDo((_id, _rev) => {
        const index = resultCopy.docs.findIndex(doc => doc && doc._id === _id);
        expect(index).toBeDefined();
        delete resultCopy.docs[index];
      });

    await extendedWinstonCloudant.housekeeping();

    expect(resultCopy.docs).toEqual([undefined, undefined, undefined]);
  });
});
