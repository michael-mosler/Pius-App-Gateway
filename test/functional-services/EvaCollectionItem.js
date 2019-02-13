const expect = require('expect');
const { EvaCollectionItem } = require('../../server/data-objects/EvaServiceData');

describe('EvaCollectionItem', () => {
  it('should compute epoche', () => {
    const evaCollectionItem = new EvaCollectionItem('Freitag, 01.02.2019', []);
    expect(evaCollectionItem.epoch).toBe(1548979200);
  });

  it('should throw on invalid date format', () => {
    try {
      // eslint-disable-next-line no-unused-vars
      const _ = new EvaCollectionItem('Freitag', []);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.constructor.name).toBe('Error');
    }
  });
});
