const md5 = require('md5');
const supertest = require('supertest');
const td = require('testdouble');
const express = require('express');

describe('StaffHandler process', () => {
  let app;
  let StaffDb;

  beforeEach(() => {
    app = express();
    process.env.DIGEST_CHECK = 'true';

    const LogService = td.replace('../../server/helper/LogService');
    LogService.prototype.logger = td.constructor();
    LogService.prototype.logger = {
      debug: td.function(),
      info: td.function(),
      warn: td.function(),
      error: td.function(),
    };

    const { StaffDb: _StaffDb } = td.replace('../../server/providers/StaffDb');
    StaffDb = _StaffDb;
  });

  afterEach(() => td.reset());

  it('should send status 200 and data', (done) => {
    const staffDoc = { _id: 'A', _rev: 'B', staffDictionary: { aaaa: { name: 'AAAA', subjects: ['A'] } } };
    const digest = `${md5(JSON.stringify(staffDoc))}XXXX`;

    td.when(StaffDb.prototype.get())
      .thenResolve(staffDoc);

    const StaffHandler = require('../../server/v2-services/StaffHandler');
    const staffHandler = new StaffHandler();

    app.get('/v2/staff', (req, res) => {
      staffHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/staff')
      .query({ digest })
      .expect(staffDoc)
      .expect(200, done);
  });

  it('should send status 304 when not modified', (done) => {
    const staffDoc = { _id: 'A', _rev: 'B', staffDictionary: { aaaa: { name: 'AAAA', subjects: ['A'] } } };
    const digest = `${md5(JSON.stringify(staffDoc))}`;

    td.when(StaffDb.prototype.get())
      .thenResolve(staffDoc);

    const StaffHandler = require('../../server/v2-services/StaffHandler');
    const staffHandler = new StaffHandler();

    app.get('/v2/staff', (req, res) => {
      staffHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/staff')
      .query({ digest })
      .expect(304, done);
  });

  it('should send status 500 on error', (done) => {
    const staffDoc = { _id: 'A', _rev: 'B', staffDictionary: { aaaa: { name: 'AAAA', subjects: ['A'] } } };
    const digest = `${md5(JSON.stringify(staffDoc))}`;

    td.when(StaffDb.prototype.get())
      .thenReject(new Error('Failed'));

    const StaffHandler = require('../../server/v2-services/StaffHandler');
    const staffHandler = new StaffHandler();

    app.get('/v2/staff', (req, res) => {
      staffHandler.process(req, res);
    });

    supertest.agent(app)
      .get('/v2/staff')
      .query({ digest })
      .expect(500, done);
  });
});
