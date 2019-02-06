const td = require('testdouble');
const expect = require('expect');

/**
 * EvaService
 */
describe('EvaService', () => {
  let CloudantDb;
  let EvaDoc;

  beforeEach(() => {
    CloudantDb = td.replace('../../server/core-services/CloudantDb');
    let m = td.replace('../../server/data-objects/EvaServiceData');
    EvaDoc = m.EvaDoc;
  });

  afterEach(() => {
    td.reset();
  });

  it('should not update when already up to date', async () => {
    const { EvaService } = require('../../server/functional-services/EvaService');

    td.when(CloudantDb.prototype.get('EF'))
      .thenResolve({ });
    td.when(CloudantDb.prototype.insertDocument(td.matchers.anything()))
      .thenThrow(new Error('Should not have been called'));
    td.when(EvaDoc.prototype.contains(td.matchers.isA(Object)))
      .thenReturn(true);

    try {
      const evaService = new EvaService();
      await evaService.merge('EF', 'Freitag, 08.02.2019');
    } catch (err) {
      expect(false).toBeTruthy(err);
    }
  });
});
