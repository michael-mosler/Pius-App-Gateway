const md5 = require('md5');
const expect = require('expect');
const td = require('testdouble');

describe('StaffLoaderJob', () => {
  let staff;
  let staffDoc;
  let StaffDb;
  let StaffLoader;

  beforeEach(() => {
    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    staff = td.object({ dictionary: { aaaa: { name: 'AAAA', subjects: ['A'] } } });
    staffDoc = td.object({ _id: 'staff', _rev: 'abcd', staffDictionary: staff });
    staffDoc._digest = md5(JSON.stringify(staffDoc));

    const { StaffDb: _StaffDb } = td.replace('../../server/providers/StaffDb');
    StaffDb = _StaffDb;

    const { StaffLoader: _StaffLoader } = td.replace('../../server/functional-services/StaffLoader');
    StaffLoader = _StaffLoader;
  });

  afterEach(() => td.reset());

  it('should fill db', async () => {
    td.when(StaffLoader.prototype.loadFromWeb())
      .thenResolve(staff);
    td.when(StaffDb.prototype.get())
      .thenResolve(staffDoc);
    td.when(StaffDb.prototype.insertDocument(td.matchers.contains({
      _id: 'staff',
      _rev: 'abcd',
      staffDictionary: { aaaa: { name: 'AAAA', subjects: ['A'] } },
    })))
      .thenResolve({ });

    const { StaffLoaderJob } = require('../../server/functional-services/StaffLoaderJob');
    const staffLoaderJob = new StaffLoaderJob();
    await expect(staffLoaderJob.run()).resolves.toBeDefined();
  });
});
