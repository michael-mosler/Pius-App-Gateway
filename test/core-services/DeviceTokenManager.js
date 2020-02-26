const sha1 = require('sha1');
const supertest = require('supertest');
const td = require('testdouble');
const expect = require('expect');
const express = require('express');
const VertretungsplanHelper = require('../../server/helper/VertretungsplanHelper');

/**
 * DeviceTokenManager tests.
 */
describe('DeviceTokenManager', () => {
  let app;
  let Config;
  let CloudantDb;

  beforeEach(() => {
    app = express();
    app.use(require('body-parser')());

    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    Config = td.replace('../../server/core-services/Config');
    Config.apiKey = sha1('apiKey');

    CloudantDb = td.replace('../../server/core-services/CloudantDb');

    td.replace(VertretungsplanHelper, 'isUpperGrade');
    td.when(VertretungsplanHelper.isUpperGrade('5A'))
      .thenReturn(false);
    td.when(VertretungsplanHelper.isUpperGrade('Q1'))
      .thenReturn(true);
  });

  afterEach(() => td.reset());

  it('should deny invalid api key', done => {
    const agent = supertest.agent(app);

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager();

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'invalidApiKey',
        deviceToken: 'token',
        grade: null,
        courseList: null,
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(401)
      .end(err => done(err));
  });

  it('should register valid lower grade token', done => {
    const thisGrade = '5A';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument(td.matchers.not({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: [],
      messagingProvider: 'apn',
      version: '1.0',
      credential: undefined,
    }))).thenReject(new Error('Unexpected call to destroy()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenReject(new Error('Unexpected call to destroy()'));

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager();

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    supertest.agent(app)
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: null,
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('should register valid upper grade token', done => {
    const thisGrade = 'Q1';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument(td.matchers.not({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: ['M LK1'],
      messagingProvider: 'apn',
      version: '1.0',
      credential: undefined,
    }))).thenReject(new Error('Unexpected call to insertDocument()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenReject(new Error('Unexpected call to destroy()'));

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager();

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    // Test, will throw when not running as expected.
    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: ['M LK1'],
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('should delete invalid lower grade token', done => {
    const thisGrade = null;

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: [],
      messagingProvider: 'apn',
      version: '1.0',
      credential: undefined,
    })).thenReject(new Error('Unexpected call to insertDocument()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenResolve();

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager();

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: null,
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('should ignore not existing invalid lower grade token', done => {
    const thisGrade = null;

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ });

    td.when(CloudantDb.prototype.insertDocument({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: [],
      messagingProvider: 'apn',
      version: '1.0',
      credential: undefined,
    })).thenReject(new Error('Unexpected call to insertDocument()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenReject(new Error('Unexpected call to destroy()'));

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager();

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: null,
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('should delete invalid upper grade token', done => {
    const thisGrade = 'Q1';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: [],
      messagingProvider: 'apn',
      version: '1.0',
      credential: undefined,
    })).thenReject(new Error('Unexpected call to insertDocument()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenResolve();

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager();

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: null,
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('should get tokens by grade and credential', async () => {
    td.when(CloudantDb.prototype.find({ selector: { grade: 'grade' } }))
      .thenResolve({ _id: 1 });

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager();
    let _ = await deviceTokenManager.getDeviceTokens({ forGrade: 'grade' });
    expect(_).toEqual({ _id: 1 });

    td.when(CloudantDb.prototype.find({ selector: { credential: 'credential' } }))
      .thenResolve({ _id: 1 });
    _ = await deviceTokenManager.getDeviceTokens({ forCredential: 'credential' });
    expect(_).toEqual({ _id: 1 });

    try {
      await deviceTokenManager.getDeviceTokens();
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err).toBeDefined();
    }

    try {
      await deviceTokenManager.getDeviceTokens({ forGrade: 'grade', forCredential: 'credential' });
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

describe('DeviceTokenManager v2', () => {
  let app;
  let Config;
  let CloudantDb;
  let BlacklistService;

  beforeEach(() => {
    app = express();
    app.use(require('body-parser')());

    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    Config = td.replace('../../server/core-services/Config');
    Config.apiKey = sha1('apiKey');

    CloudantDb = td.replace('../../server/core-services/CloudantDb');
    BlacklistService = td.replace('../../server/functional-services/BlacklistService');

    td.replace(VertretungsplanHelper, 'isUpperGrade');
    td.when(VertretungsplanHelper.isUpperGrade('5A'))
      .thenReturn(false);
    td.when(VertretungsplanHelper.isUpperGrade('Q1'))
      .thenReturn(true);
  });

  afterEach(() => td.reset());

  it('v2: should register valid lower grade token', done => {
    const thisGrade = '5A';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument(td.matchers.not({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: [],
      messagingProvider: 'apn',
      version: '1.0',
      credential: 'sha1',
    }))).thenThrow(new Error('unexpected args to insertDocument'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenReject(new Error('Unexpected call to destroy()'));
    td.when(BlacklistService.prototype.isBlacklisted('sha1'))
      .thenResolve(false);

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager('v2');

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    supertest.agent(app)
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: null,
        messagingProvider: 'apn',
        version: '1.0',
        credential: 'sha1',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('v2: should register valid upper grade token', done => {
    const thisGrade = 'Q1';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument(td.matchers.not({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: ['M LK1'],
      messagingProvider: 'apn',
      version: '1.0',
      credential: 'sha1',
    }))).thenResolve(new Error('Unexpected call to destroy()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenReject(new Error('Unexpected call to destroy()'));
    td.when(BlacklistService.prototype.isBlacklisted('sha1'))
      .thenResolve(false);

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager('v2');

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    // Test, will throw when not running as expected.
    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: ['M LK1'],
        messagingProvider: 'apn',
        version: '1.0',
        credential: 'sha1',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('v2: should delete invalid lower grade token', done => {
    const thisGrade = '5A';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: [],
      messagingProvider: 'apn',
      version: '1.0',
      credential: '',
    })).thenReject(new Error('Unexpected call to insertDocument()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenResolve();
    td.when(BlacklistService.prototype.isBlacklisted('sha1'))
      .thenResolve(false);

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager('v2');

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: null,
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('v2: should delete invalid upper grade token', done => {
    const thisGrade = 'Q1';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: ['M LK1'],
      messagingProvider: 'apn',
      version: '1.0',
    })).thenReject(new Error('Unexpected call to insertDocument()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenResolve();
    td.when(BlacklistService.prototype.isBlacklisted('sha1'))
      .thenResolve(false);

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager('v2');

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: [],
        messagingProvider: 'apn',
        version: '1.0',
      })
      .expect(200)
      .end(err => done(err));
  });

  it('v2: should not register blacklisted token', done => {
    const thisGrade = 'Q1';

    td.when(CloudantDb.prototype.get('token'))
      .thenResolve({ _id: 'token', _rev: 'document-rev', grade: thisGrade });

    td.when(CloudantDb.prototype.insertDocument({
      _id: 'token',
      _rev: 'document-rev',
      grade: thisGrade,
      courseList: ['M LK1'],
      messagingProvider: 'apn',
      version: '1.0',
      credential: 'sha1',
    })).thenReject(new Error('Unexpected call to insertDocument()'));

    td.when(CloudantDb.prototype.destroy(td.matchers.anything()))
      .thenResolve();
    td.when(BlacklistService.prototype.isBlacklisted('sha1'))
      .thenResolve(true);

    const DeviceTokenManager = require('../../server/core-services/DeviceTokenManager');
    const deviceTokenManager = new DeviceTokenManager('v2');

    app.post('/register', (req, res) => {
      deviceTokenManager.registerDeviceToken(req, res);
    });

    const agent = supertest.agent(app);

    agent
      .post('/register')
      .set('Content-Type', 'application/json')
      .send({
        apiKey: 'apiKey',
        deviceToken: 'token',
        grade: thisGrade,
        courseList: [],
        messagingProvider: 'apn',
        version: '1.0',
        credential: 'sha1',
      })
      .expect(200)
      .end(err => done(err));
  });
});
