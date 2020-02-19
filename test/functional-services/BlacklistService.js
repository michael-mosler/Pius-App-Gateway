const expect = require('expect');
const td = require('testdouble');

describe('BlacklistService', () => {
  let Credential;
  let BlacklistedCredentialsDb;

  beforeEach(() => {
    const { Credential: Credential_, BlacklistedCredentialsDb: BlacklistedCredentialsDb_ } = td.replace('../../server/providers/BlacklistedCredentialsDb');
    Credential = Credential_;
    BlacklistedCredentialsDb = BlacklistedCredentialsDb_;
  });

  afterEach(() => td.reset());

  it('should get blacklisted credential', async () => {
    const credential = td.object(['id']);
    td.when(Credential.prototype.constructor({ userId: 'userId', pwd: 'pwd' }))
      .thenReturn(credential);

    td.when(BlacklistedCredentialsDb.prototype.get(credential))
      .thenResolve(credential);

    const BlacklistService = require('../../server/functional-services/BlacklistService');
    const blacklistService = new BlacklistService();

    const returnedCredential = await blacklistService.checkBlacklisted('userId', 'pwd');
    expect(returnedCredential).toHaveProperty('id');
  });

  it('should blacklist correctly', async () => {
    const credential = td.object(['id']);
    td.when(BlacklistedCredentialsDb.prototype.insertDocument(td.matchers.not(credential)))
      .thenThrow(new Error('unexpected value passed to insertDocument'));

    const BlacklistService = require('../../server/functional-services/BlacklistService');
    const blacklistService = new BlacklistService();

    try {
      await blacklistService.blacklist(credential);
    } catch (err) {
      expect(false).toBeTruthy();
    }
  });

  it('should delete credential in delisting when blacklisted', async () => {
    const credential = td.object(['id']);
    credential.isBlacklisted = true;
    td.when(Credential.prototype.constructor({ userId: 'userId', pwd: 'pwd' }))
      .thenReturn(credential);

    td.when(BlacklistedCredentialsDb.prototype.get(credential))
      .thenResolve(credential);

    td.when(BlacklistedCredentialsDb.prototype.destroy(credential))
      .thenResolve(1);

    const BlacklistService = require('../../server/functional-services/BlacklistService');
    const blacklistService = new BlacklistService();

    const _ = await blacklistService.delist('userId', 'pwd');
    expect(_).toEqual(1);
  });

  it('should ignore not-existing credential in delisting', async () => {
    const credential = td.object(['id']);
    credential.isBlacklisted = false;
    td.when(Credential.prototype.constructor({ userId: 'userId', pwd: 'pwd' }))
      .thenReturn(credential);

    td.when(BlacklistedCredentialsDb.prototype.get(credential))
      .thenResolve(credential);

    td.when(BlacklistedCredentialsDb.prototype.destroy(credential))
      .thenResolve(1);

    const BlacklistService = require('../../server/functional-services/BlacklistService');
    const blacklistService = new BlacklistService();

    const _ = await blacklistService.delist('userId', 'pwd');
    expect(_).toBeUndefined();
  });
});
