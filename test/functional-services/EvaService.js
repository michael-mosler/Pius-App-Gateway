const td = require('testdouble');
const expect = require('expect');
const PushEventEmitter = require('../../server/functional-services/PushEventEmitter');

/**
 * EvaService
 */
describe('EvaService', () => {
  let CloudantDb;

  beforeEach(() => {
    CloudantDb = td.replace('../../server/core-services/CloudantDb');
  });

  afterEach(() => {
    td.reset();
  });

  it('should not update when already up to date', async () => {
    let m = td.replace('../../server/data-objects/EvaServiceData');
    let EvaDoc = m.EvaDoc;

    try {
      td.when(CloudantDb.prototype.get('EF'))
        .thenReturn({ });
      td.when(CloudantDb.prototype.insertDocument(td.matchers.anything()))
        .thenThrow(new Error('Should not have been called'));
      td.when(EvaDoc.prototype.contains(td.matchers.isA(Object)))
        .thenReturn(true);

      const EvaService = require('../../server/functional-services/EvaService');
      const evaService = new EvaService();
      await evaService.merge('EF', 'Freitag, 08.02.2019');
    } catch (err) {
      expect(false).toBeTruthy(err);
    }
  });

  it('should update on change', async () => {
    let m = td.replace('../../server/data-objects/EvaServiceData');
    let EvaDoc = m.EvaDoc;

    try {
      td.when(CloudantDb.prototype.get('EF'))
        .thenReturn({ });
      td.when(CloudantDb.prototype.insertDocument({ test: 'object' }))
        .thenReturn({ result: 'object' });
      td.when(EvaDoc.prototype.contains(td.matchers.isA(Object)))
        .thenReturn(false);
      td.when(EvaDoc.prototype.merge(td.matchers.isA(Object)))
        .thenReturn({ test: 'object' });

      const EvaService = require('../../server/functional-services/EvaService');
      const evaService = new EvaService();
      let r = await evaService.merge('EF', 'Freitag, 08.02.2019');
      expect(r).toEqual({ result: 'object' });
    } catch (err) {
      expect(false).toBeTruthy(err);
    }
  });

  it('should update from change list item', async () => {
    let { EvaItem } = td.replace('../../server/data-objects/EvaServiceData');

    const fs = require('fs');
    const changeListItem = JSON.parse(fs.readFileSync('./test/functional-services/ChangeListItem.json'));

    td.when(EvaItem.prototype.constructor(' D L1', ' EVA Text Freitag 08.02.2019, D L1'), { times: 1 })
      .thenReturn({ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' });
    td.when(EvaItem.prototype.constructor(' SP G4', ' EVA Text Montag 11.02.2019, SP G4'), { times: 1 })
      .thenReturn({ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' });

    const EvaService = require('../../server/functional-services/EvaService');
    EvaService.prototype.merge = td.function();

    const evaService = new EvaService();
    await evaService.updateFrom(changeListItem);

    td.verify(EvaService.prototype.merge('Q2', 'Donnerstag, 07.02.2019', []));
    td.verify(EvaService.prototype.merge('Q2', 'Freitag, 08.02.2019', [{ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' }]));
    td.verify(EvaService.prototype.merge('Q2', 'Montag, 11.02.2019', [{ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' }]));
  });

  it('should update on event', (done) => {
    let { EvaItem } = td.replace('../../server/data-objects/EvaServiceData');

    const fs = require('fs');
    const changeListItem = JSON.parse(fs.readFileSync('./test/functional-services/ChangeListItem.json'));

    td.when(EvaItem.prototype.constructor(' D L1', ' EVA Text Freitag 08.02.2019, D L1'), { times: 1 })
      .thenReturn({ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' });
    td.when(EvaItem.prototype.constructor(' SP G4', ' EVA Text Montag 11.02.2019, SP G4'), { times: 1 })
      .thenReturn({ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' });

    const EvaService = require('../../server/functional-services/EvaService');
    EvaService.prototype.merge = td.function();

    // eslint-disable-next-line no-unused-vars
    const _ = new EvaService();
    const pushEventEmitter = new PushEventEmitter();
    pushEventEmitter.emit('push', changeListItem);

    setTimeout(() => {
      td.verify(EvaService.prototype.merge('Q2', 'Donnerstag, 07.02.2019', []));
      td.verify(EvaService.prototype.merge('Q2', 'Freitag, 08.02.2019', [{ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' }]));
      td.verify(EvaService.prototype.merge('Q2', 'Montag, 11.02.2019', [{ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' }]));
      done();
    }, 500);
  });

  it('should get EVA items for grade with course list', async () => {
    const fs = require('fs');
    const evaDoc = JSON.parse(fs.readFileSync('./test/functional-services/EvaDoc.json'));
    const evaDocMatched = JSON.parse(fs.readFileSync('./test/functional-services/EvaDocMatched.json'));

    try {
      td.when(CloudantDb.prototype.get('EF'))
        .thenReturn(evaDoc);

      const EvaService = require('../../server/functional-services/EvaService');
      const evaService = new EvaService();
      let r = await evaService.getEvaItems('EF', 'M LK1, D GK2, SP GK4');
      expect(r).toEqual(evaDocMatched);
    } catch (err) {
      expect(false).toBeTruthy(err);
    }
  });

  it('should get EVA items for grade without course list', async () => {
    const fs = require('fs');
    const evaDoc = JSON.parse(fs.readFileSync('./test/functional-services/EvaDoc.json'));

    try {
      td.when(CloudantDb.prototype.get('EF'))
        .thenReturn(evaDoc);

      const EvaService = require('../../server/functional-services/EvaService');
      const evaService = new EvaService();
      let r = await evaService.getEvaItems('EF');
      expect(r).toEqual(evaDoc.evaCollection);
    } catch (err) {
      expect(false).toBeTruthy(err);
    }
  });

  it('should deal with empty EVA items document', async () => {
    try {
      td.when(CloudantDb.prototype.get('EF'))
        .thenReturn({});

      const EvaService = require('../../server/functional-services/EvaService');
      const evaService = new EvaService();
      let r = await evaService.getEvaItems('EF');
      expect(r).toEqual([]);
    } catch (err) {
      expect(false).toBeTruthy(err);
    }
  });
});
