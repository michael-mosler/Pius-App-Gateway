// const td = require('testdouble');
const expect = require('expect');
const td = require('testdouble');
const { Credential } = require('../../server/providers/BlacklistedCredentialsDb');

describe('Credential', () => {
  it('should instantiate from username and password', () => {
    const credential = new Credential({ userId: 'name', pwd: 'pwd' });
    expect(credential.id).toBeDefined();
    expect(credential.rev).toBeUndefined();
    expect(credential.timestamp).toBeUndefined();
    expect(credential.isBlacklisted).toBeFalsy();
  });

  it('should instantiate from DB doc', () => {
    const doc = {
      _id: 'sha1',
      _rev: 'rev',
      timestamp: 'ts',
    };
    const credential = new Credential({ doc });
    expect(credential.id).toEqual(doc._id);
    expect(credential.rev).toEqual(doc._rev);
    expect(credential.timestamp).toEqual(doc.timestamp);
    expect(credential.isBlacklisted).toBeTruthy();
  });
});

describe('BlacklistedCredentialsDb', () => {
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

  afterEach(() => td.reset());

  it('should get Credentials with input object', async () => {
    const request = new Credential({ userId: 'user', pwd: 'pwd' });
    const date = new Date();
    const replyDoc = {
      _id: request.id,
      _rev: 'rev',
      timestamp: date,
    };

    td.when(CloudantDb.prototype.get(request.id))
      .thenResolve(replyDoc);

    const { BlacklistedCredentialsDb } = require('../../server/providers/BlacklistedCredentialsDb');
    const blacklistedCredentialsDb = new BlacklistedCredentialsDb();

    const realResultDoc = await blacklistedCredentialsDb.get(request);
    expect(realResultDoc.constructor.name).toEqual('Credential');
    expect(realResultDoc.id).toEqual(replyDoc._id);
    expect(realResultDoc.rev).toEqual(replyDoc._rev);
    expect(realResultDoc.timestamp).toEqual(date);
    expect(realResultDoc.isBlacklisted).toBeTruthy();
  });

  it('should get Credentials with input string', async () => {
    const date = new Date();
    const replyDoc = {
      _id: 'sha1',
      _rev: 'rev',
      timestamp: date,
    };

    td.when(CloudantDb.prototype.get('sha1'))
      .thenResolve(replyDoc);

    const { BlacklistedCredentialsDb } = require('../../server/providers/BlacklistedCredentialsDb');
    const blacklistedCredentialsDb = new BlacklistedCredentialsDb();

    const realResultDoc = await blacklistedCredentialsDb.get('sha1');
    expect(realResultDoc.constructor.name).toEqual('Credential');
    expect(realResultDoc.id).toEqual(replyDoc._id);
    expect(realResultDoc.rev).toEqual(replyDoc._rev);
    expect(realResultDoc.timestamp).toEqual(date);
    expect(realResultDoc.isBlacklisted).toBeTruthy();
  });

  it('should throw on error', async () => {
    const request = new Credential({ userId: 'user', pwd: 'pwd' });

    td.when(CloudantDb.prototype.get(request.id))
      .thenThrow(new Error('intended error'));

    const { BlacklistedCredentialsDb } = require('../../server/providers/BlacklistedCredentialsDb');
    const blacklistedCredentialsDb = new BlacklistedCredentialsDb();

    try {
      await blacklistedCredentialsDb.get(request);
      expect(false).toBeTruthy();
    } catch (err) { }
  });
});
