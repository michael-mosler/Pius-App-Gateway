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

  it('should skip document update when up to date', async () => {
    let { EvaCollectionItem, EvaItem, EvaDoc } = td.replace('../../server/data-objects/EvaServiceData');

    const fs = require('fs');
    const changeListItem = JSON.parse(fs.readFileSync('./test/functional-services/ChangeListItem.json'));

    td.when(CloudantDb.prototype.get('Q2'))
      .thenReturn({ test: 'object' });
    td.when(CloudantDb.prototype.insertDocument(td.matchers.contains({ _id: 'Q2', test: 'object' })))
      .thenReturn({});

    td.when(EvaItem.prototype.constructor(' D L1', ' EVA Text Freitag 08.02.2019, D L1'), { times: 1 })
      .thenReturn({ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' });
    td.when(EvaItem.prototype.constructor(' SP G4', ' EVA Text Montag 11.02.2019, SP G4'), { times: 1 })
      .thenReturn({ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' });

    td.when(EvaCollectionItem.prototype.constructor('Donnerstag, 07.02.2019', []))
      .thenReturn({ test: 'object0' });
    td.when(EvaCollectionItem.prototype.constructor('Freitag, 08.02.2019', [{ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' }]))
      .thenReturn({ test: 'object1' });
    td.when(EvaCollectionItem.prototype.constructor('Montag, 11.02.2019', [{ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' }]))
      .thenReturn({ test: 'object2' });

    td.when(EvaDoc.prototype.constructor(td.matchers.contains({ _id: 'Q2', test: 'object' })))
      .thenReturn({ _id: 'Q2', test: 'object', evaCollection: [], contains: () => true });

    const EvaService = require('../../server/functional-services/EvaService');

    const evaService = new EvaService();
    const doc = await evaService.updateFrom(changeListItem);
    expect(doc).not.toBeNull();
  });

  it('should not fail on insertDocument error', async () => {
    let { EvaCollectionItem, EvaItem, EvaDoc } = td.replace('../../server/data-objects/EvaServiceData');

    const fs = require('fs');
    const changeListItem = JSON.parse(fs.readFileSync('./test/functional-services/ChangeListItem.json'));

    td.when(CloudantDb.prototype.get('Q2'))
      .thenReturn({ test: 'object' });
    td.when(CloudantDb.prototype.insertDocument(td.matchers.contains({ _id: 'Q2', test: 'object' })))
      .thenReject(new Error('Document update error'));

    td.when(EvaItem.prototype.constructor(' D L1', ' EVA Text Freitag 08.02.2019, D L1'), { times: 1 })
      .thenReturn({ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' });
    td.when(EvaItem.prototype.constructor(' SP G4', ' EVA Text Montag 11.02.2019, SP G4'), { times: 1 })
      .thenReturn({ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' });

    td.when(EvaCollectionItem.prototype.constructor('Donnerstag, 07.02.2019', []))
      .thenReturn({ test: 'object0' });
    td.when(EvaCollectionItem.prototype.constructor('Freitag, 08.02.2019', [{ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' }]))
      .thenReturn({ test: 'object1' });
    td.when(EvaCollectionItem.prototype.constructor('Montag, 11.02.2019', [{ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' }]))
      .thenReturn({ test: 'object2' });

    td.when(EvaDoc.prototype.constructor(td.matchers.contains({ _id: 'Q2', test: 'object' })))
      .thenReturn({ _id: 'Q2', test: 'object', evaCollection: [], contains: () => true });

    const EvaService = require('../../server/functional-services/EvaService');

    const evaService = new EvaService();
    const doc = await evaService.updateFrom(changeListItem);
    expect(doc).toBeNull();
  });

  it('should update when changed', async () => {
    let { EvaCollectionItem, EvaItem, EvaDoc } = td.replace('../../server/data-objects/EvaServiceData');

    const fs = require('fs');
    const changeListItem = JSON.parse(fs.readFileSync('./test/functional-services/ChangeListItem.json'));

    td.when(CloudantDb.prototype.get('Q2'))
      .thenReturn({ test: 'object' });
    td.when(CloudantDb.prototype.insertDocument(td.matchers.contains({ _id: 'Q2', test: 'object' })))
      .thenReturn({});

    td.when(EvaItem.prototype.constructor(' D L1', ' EVA Text Freitag 08.02.2019, D L1'), { times: 1 })
      .thenReturn({ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' });
    td.when(EvaItem.prototype.constructor(' SP G4', ' EVA Text Montag 11.02.2019, SP G4'), { times: 1 })
      .thenReturn({ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' });

    td.when(EvaCollectionItem.prototype.constructor('Donnerstag, 07.02.2019', []))
      .thenReturn({ test: 'object0' });
    td.when(EvaCollectionItem.prototype.constructor('Freitag, 08.02.2019', [{ course: ' D L1', evaText: ' EVA Text Freitag 08.02.2019, D L1' }]))
      .thenReturn({ test: 'object1' });
    td.when(EvaCollectionItem.prototype.constructor('Montag, 11.02.2019', [{ course: ' SP G4', evaText: ' EVA Text Montag 11.02.2019, SP G4' }]))
      .thenReturn({ test: 'object2' });

    const contains = td.function();
    td.when(contains(td.matchers.anything()))
      .thenReturn(false);
    const merge = td.function();
    td.when(merge({ test: 'object0' }))
      .thenReturn({ evaCollection: [], contains, merge });
    td.when(merge({ test: 'object1' }))
      .thenReturn({ evaCollection: [], contains, merge });
    td.when(merge({ test: 'object2' }))
      .thenReturn({ evaCollection: [], contains, merge });

    td.when(EvaDoc.prototype.constructor(td.matchers.contains({ _id: 'Q2', test: 'object' })))
      .thenReturn({ _id: 'Q2', test: 'object', evaCollection: [], contains, merge });

    const EvaService = require('../../server/functional-services/EvaService');

    const evaService = new EvaService();
    const doc = await evaService.updateFrom(changeListItem);
    expect(doc).not.toBeNull();
  });

  it('should update on event', (done) => {
    const fs = require('fs');
    const changeListItem = JSON.parse(fs.readFileSync('./test/functional-services/ChangeListItem.json'));

    const EvaService = require('../../server/functional-services/EvaService');
    EvaService.prototype.updateFrom = td.function();

    // eslint-disable-next-line no-unused-vars
    const _ = new EvaService();
    const pushEventEmitter = new PushEventEmitter();
    pushEventEmitter.emit('push', changeListItem);

    setTimeout(() => {
      td.verify(EvaService.prototype.updateFrom(changeListItem));
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
      let r = await evaService.getEvaItems('EF', 'MLK1,DGK2,SPGK4');
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
