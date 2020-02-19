const supertest = require('supertest');
const td = require('testdouble');
const express = require('express');
const VertretungsplanHelper = require('../../server/helper/VertretungsplanHelper');

/*
 * These tests focus on process logic of VetretungsplanHandler and not on actual
 * backend response transformation This is why /200 test mocks transformAndSend.
 */
describe('VertretungsplanHandler', () => {
  let app;
  let request;
  let BlacklistService;

  beforeEach(() => {
    app = express();

    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    request = td.replace('request');
    BlacklistService = td.replace('../../server/functional-services/BlacklistService.js');
  });

  afterEach(() => td.reset());

  it('should reject on blacklisted with 401', (done) => {
    const credential = td.object();
    credential.isBlacklisted = true;
    td.when(BlacklistService.prototype.checkBlacklisted('userId', 'pwd'))
      .thenReturn(credential);

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/v2/vertretungsplan', (req, res) => {
      vertretungsplanHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/vertretungsplan')
      .auth('userId', 'pwd')
      .expect(401, done);
  });

  it('should reject on blacklist check error with 500', (done) => {
    td.when(BlacklistService.prototype.checkBlacklisted('userId', 'pwd'))
      .thenThrow(new Error('intended error'));

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/v2/vertretungsplan', (req, res) => {
      vertretungsplanHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/vertretungsplan')
      .auth('userId', 'pwd')
      .expect(500, done);
  });

  it('should blacklist invalid credentials/status 401', (done) => {
    const credential = td.object();
    credential.isBlacklisted = false;
    td.when(BlacklistService.prototype.checkBlacklisted('userId', 'pwd'))
      .thenReturn(credential);
    td.when(BlacklistService.prototype.blacklist(td.matchers.contains({ isBlacklisted: false })))
      .thenReturn(credential);

    td.when(request.get(td.matchers.isA(String), td.matchers.isA(Object), td.callback))
      .thenCallback(null, { statusCode: 401 }, {});

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/v2/vertretungsplan', (req, res) => {
      vertretungsplanHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/vertretungsplan')
      .auth('userId', 'pwd')
      .expect(401, done);
  });

  it('should blacklist invalid credentials/status 403', (done) => {
    const credential = td.object();
    credential.isBlacklisted = false;
    td.when(BlacklistService.prototype.checkBlacklisted('userId', 'pwd'))
      .thenReturn(credential);
    td.when(BlacklistService.prototype.blacklist(td.matchers.contains({ isBlacklisted: false })))
      .thenReturn(credential);

    td.when(request.get(td.matchers.isA(String), td.matchers.isA(Object), td.callback))
      .thenCallback(null, { statusCode: 403 }, {});

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/v2/vertretungsplan', (req, res) => {
      vertretungsplanHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/vertretungsplan')
      .auth('userId', 'pwd')
      .expect(403, done);
  });

  it('should pass through any other status error', (done) => {
    const credential = td.object();
    credential.isBlacklisted = false;
    td.when(BlacklistService.prototype.checkBlacklisted('userId', 'pwd'))
      .thenReturn(credential);
    td.when(BlacklistService.prototype.blacklist(td.matchers.contains({ isBlacklisted: false })))
      .thenReturn(credential);

    td.when(request.get(td.matchers.isA(String), td.matchers.isA(Object), td.callback))
      .thenCallback(null, { statusCode: 501 }, {});

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/v2/vertretungsplan', (req, res) => {
      vertretungsplanHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/vertretungsplan')
      .auth('userId', 'pwd')
      .expect(501, done);
  });

  it('should return status 500 on blacklist error', (done) => {
    const credential = td.object();
    credential.isBlacklisted = false;
    td.when(BlacklistService.prototype.checkBlacklisted('userId', 'pwd'))
      .thenReturn(credential);
    td.when(BlacklistService.prototype.blacklist(td.matchers.contains({ isBlacklisted: false })))
      .thenThrow(new Error('intented error'));

    td.when(request.get(td.matchers.isA(String), td.matchers.isA(Object), td.callback))
      .thenCallback(null, { statusCode: 401 }, {});

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/v2/vertretungsplan', (req, res) => {
      vertretungsplanHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/vertretungsplan')
      .auth('userId', 'pwd')
      .expect(500, done);
  });

  it('should transform and send on HTTP status 200', (done) => {
    const credential = td.object();
    credential.isBlacklisted = false;
    td.when(BlacklistService.prototype.checkBlacklisted('userId', 'pwd'))
      .thenReturn(credential);
    td.when(BlacklistService.prototype.blacklist(td.matchers.contains({ isBlacklisted: false })))
      .thenReturn(credential);

    td.when(request.get(td.matchers.isA(String), td.matchers.isA(Object), td.callback))
      .thenCallback(null, { statusCode: 200 }, { data: 'data' });

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    VertretungsplanHandler.prototype.transformAndSend = td.function();
    td.when(VertretungsplanHandler.prototype.transformAndSend(td.matchers.contains({ data: 'data' }), td.matchers.isA(Object), td.matchers.isA(Object)))
      .thenDo((data, req, res) => {
        res.status(200).end();
      });

    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/v2/vertretungsplan', (req, res) => {
      vertretungsplanHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/vertretungsplan')
      .auth('userId', 'pwd')
      .expect(200, done);
  });
});

describe('ValidateLogin', () => {
  let app;
  let BlacklistService;

  beforeEach(() => {
    app = express();

    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    BlacklistService = td.replace('../../server/functional-services/BlacklistService.js');
  });

  afterEach(() => td.reset());

  it('should delist on succesful login', (done) => {
    td.when(BlacklistService.prototype.delist('userId', 'pwd'))
      .thenResolve(1);

    td.replace(VertretungsplanHelper, 'validateLogin');
    td.when(VertretungsplanHelper.validateLogin(td.matchers.contains({ headers: { authorization: 'Basic dXNlcklkOnB3ZA==' } })))
      .thenResolve(200);

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/validateLogin', (req, res) => {
      vertretungsplanHandler.validateLogin(req, res);
    });

    supertest.agent(app)
      .get('/validateLogin')
      .auth('userId', 'pwd')
      .expect(200, done);
  });

  it('should skip delist on login error', (done) => {
    td.when(BlacklistService.prototype.delist('userId', 'pwd'))
      .thenReject(new Error('unexpected call to delist'));

    td.replace(VertretungsplanHelper, 'validateLogin');
    td.when(VertretungsplanHelper.validateLogin(td.matchers.contains({ headers: { authorization: 'Basic dXNlcklkOnB3ZA==' } })))
      .thenResolve(401);

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/validateLogin', (req, res) => {
      vertretungsplanHandler.validateLogin(req, res);
    });

    supertest.agent(app)
      .get('/validateLogin')
      .auth('userId', 'pwd')
      .expect(401, done);
  });

  it('should skip delist on technical error', (done) => {
    td.when(BlacklistService.prototype.delist('userId', 'pwd'))
      .thenResolve(1);

    td.replace(VertretungsplanHelper, 'validateLogin');
    td.when(VertretungsplanHelper.validateLogin(td.matchers.contains({ headers: { authorization: 'Basic dXNlcklkOnB3ZA==' } })))
      .thenReject(new Error('simulated error'));

    const VertretungsplanHandler = require('../../server/v1-services/VertretungsplanHandler');
    const vertretungsplanHandler = new VertretungsplanHandler('v2');

    app.get('/validateLogin', (req, res) => {
      vertretungsplanHandler.validateLogin(req, res);
    });

    supertest.agent(app)
      .get('/validateLogin')
      .auth('userId', 'pwd')
      .expect(503, done);
  });
});
