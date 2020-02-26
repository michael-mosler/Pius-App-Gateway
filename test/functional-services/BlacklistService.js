const expect = require('expect');
const td = require('testdouble');

describe('BlacklistService', () => {
  let Credential;
  let BlacklistedCredentialsDb;
  let DeviceTokenManager;

  beforeEach(() => {
    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    const { Credential: Credential_, BlacklistedCredentialsDb: BlacklistedCredentialsDb_ } = td.replace('../../server/providers/BlacklistedCredentialsDb');
    DeviceTokenManager = td.replace('../../server/core-services/DeviceTokenManager');
    DeviceTokenManager.prototype.destroy = td.function();
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

    const returnedCredential = await blacklistService.getCredential('userId', 'pwd');
    expect(returnedCredential).toHaveProperty('id');
  });

  it('should blacklist correctly', async () => {
    const credential = td.object(['id']);
    credential.id = 'sha1';
    td.when(DeviceTokenManager.prototype.getDeviceTokens({ forCredential: credential.id }))
      .thenResolve({ docs: [credential] });
    td.when(DeviceTokenManager.prototype.destroy(td.matchers.not(credential)))
      .thenReject(new Error('unexpected value passed to destroy'));
    td.when(BlacklistedCredentialsDb.prototype.insertDocument(td.matchers.not(credential)))
      .thenReject(new Error('unexpected value passed to insertDocument'));

    const BlacklistService = require('../../server/functional-services/BlacklistService');
    const blacklistService = new BlacklistService();

    try {
      await blacklistService.blacklist(credential);
    } catch (err) {
      expect(err).toBeUndefined();
    }
  });

  it('should blacklist correctly but refuse to delete non-unique credential', async () => {
    const credential = td.object(['id']);
    credential.id = 'sha1';
    td.when(DeviceTokenManager.prototype.getDeviceTokens({ forCredential: credential.id }))
      .thenResolve({ docs: [credential, credential] });
    td.when(DeviceTokenManager.prototype.destroy(credential))
      .thenReject(new Error('unexpected call to destroy'));
    td.when(BlacklistedCredentialsDb.prototype.insertDocument(td.matchers.not(credential)))
      .thenReject(new Error('unexpected value passed to insertDocument'));

    const BlacklistService = require('../../server/functional-services/BlacklistService');
    const blacklistService = new BlacklistService();

    try {
      await blacklistService.blacklist(credential);
    } catch (err) {
      expect(err).toBeUndefined();
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
