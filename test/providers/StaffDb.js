const expect = require('expect');
const td = require('testdouble');

describe('StaffDb', () => {
  let CloudantDb;
  beforeEach(() => {
    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    CloudantDb = td.replace('../../server/core-services/CloudantDb');
  });

  afterEach(() => td.reset);

  it('should return StaffDoc from get', async () => {
    const staffDoc = {
      _id: 'staff',
      _rev: 'abcd',
      staffDictionary: {
        aaaa: {
          name: 'AAAA',
          subjects: ['A', 'B'],
        },
        bbbb: {
          name: 'BBBB',
          subjects: ['C', 'D'],
        },
      },
    };

    td.when(CloudantDb.prototype.get('staff'))
      .thenResolve(staffDoc);

    const { StaffDb } = require('../../server/providers/StaffDb');
    const staffDb = new StaffDb();

    const doc = await staffDb.get();
    expect(doc._id).toBe('staff');
    expect(doc._rev).toBe('abcd');
    expect(doc.dictionary).toEqual(staffDoc.dictionary);
  });

  it('should return empty StaffDoc when not found', async () => {
    td.when(CloudantDb.prototype.get('staff'))
      .thenResolve({ });

    const { StaffDb } = require('../../server/providers/StaffDb');
    const staffDb = new StaffDb();

    const doc = await staffDb.get();
    expect(doc._id).toBe('staff');
    expect(doc._rev).toBeUndefined();
    expect(doc.dictionary).toBeUndefined();
  });
});
