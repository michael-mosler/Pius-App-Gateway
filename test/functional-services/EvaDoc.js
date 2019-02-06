const expect = require('expect');
const { EvaItem, EvaCollectionItem, EvaDoc } = require('../../server/data-objects/EvaServiceData');

describe('EvaDoc', () => {
  it('should find existing collection item', () => {
    const evaItems1 = [
      new EvaItem('M GK1', 'Eva Text 11'),
      new EvaItem('M GK2', 'Eva Text 12'),
    ];

    const evaItems2 = [
      new EvaItem('D GK1', 'Eva Text 21'),
      new EvaItem('D GK2', 'Eva Text 22'),
    ];

    const evaItems3 = [
      new EvaItem('D GK1', 'Eva Text 21'),
      new EvaItem('D GK2', 'Eva Text 22'),
    ];

    const evaCollectionItem1 = new EvaCollectionItem('Freitag, 01.02.2019', evaItems1);
    const evaCollectionItem2 = new EvaCollectionItem('Montag, 04.02.2019', evaItems2);
    const newEvaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', evaItems3);

    const evaDoc = new EvaDoc({ evaCollection: [evaCollectionItem1, evaCollectionItem2] });
    expect(evaDoc.contains(newEvaCollectionItem)).toBeTruthy();
  });

  it('should not find new collection item', () => {
    const evaItems1 = [
      new EvaItem('M GK1', 'Eva Text 11'),
      new EvaItem('M GK2', 'Eva Text 12'),
    ];

    const evaItems2 = [
      new EvaItem('D GK1', 'Eva Text 21'),
      new EvaItem('D GK2', 'Eva Text 22'),
    ];

    const evaItems3 = [
      new EvaItem('D GK3', 'Eva Text 31'),
      new EvaItem('D GK4', 'Eva Text 32'),
    ];

    const evaCollectionItem1 = new EvaCollectionItem('Freitag, 01.02.2019', evaItems1);
    const evaCollectionItem2 = new EvaCollectionItem('Montag, 04.02.2019', evaItems2);
    const newEvaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', evaItems3);

    const evaDoc = new EvaDoc({ evaCollection: [evaCollectionItem1, evaCollectionItem2] });
    expect(evaDoc.contains(newEvaCollectionItem)).toBeFalsy();
  });

  it('should not find collection item in empty doc', () => {
    const evaItems3 = [
      new EvaItem('D GK3', 'Eva Text 31'),
      new EvaItem('D GK4', 'Eva Text 32'),
    ];

    const newEvaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', evaItems3);

    const evaDoc = new EvaDoc();
    expect(evaDoc.contains(newEvaCollectionItem)).toBeFalsy();
  });

  it('should merge into existing doc with replace', () => {
    const evaItems1 = [
      new EvaItem('M GK1', 'Eva Text 11'),
      new EvaItem('M GK2', 'Eva Text 12'),
    ];

    const evaItems2 = [
      new EvaItem('D GK1', 'Eva Text 21'),
      new EvaItem('D GK2', 'Eva Text 22'),
    ];

    const evaItems3 = [
      new EvaItem('D GK3', 'Eva Text 31'),
      new EvaItem('D GK4', 'Eva Text 32'),
    ];

    const evaCollectionItem1 = new EvaCollectionItem('Freitag, 01.02.2019', evaItems1);
    const evaCollectionItem2 = new EvaCollectionItem('Montag, 04.02.2019', evaItems2);
    const newEvaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', evaItems3);

    let evaDoc = new EvaDoc({ evaCollection: [evaCollectionItem1, evaCollectionItem2] });
    evaDoc = evaDoc.merge(newEvaCollectionItem);

    // Length of EVA Collection has not changed.
    expect(evaDoc.evaCollection.length).toBe(2);
    expect(evaDoc.evaCollection[1]).toEqual(newEvaCollectionItem);
  });

  it('should merge into existing doc with add', () => {
    const evaItems1 = [
      new EvaItem('M GK1', 'Eva Text 11'),
      new EvaItem('M GK2', 'Eva Text 12'),
    ];

    const evaItems2 = [
      new EvaItem('D GK1', 'Eva Text 21'),
      new EvaItem('D GK2', 'Eva Text 22'),
    ];

    const evaItems3 = [
      new EvaItem('D GK3', 'Eva Text 31'),
      new EvaItem('D GK4', 'Eva Text 32'),
    ];

    const evaCollectionItem1 = new EvaCollectionItem('Freitag, 01.02.2019', evaItems1);
    const evaCollectionItem2 = new EvaCollectionItem('Montag, 04.02.2019', evaItems2);
    const newEvaCollectionItem = new EvaCollectionItem('Dienstag, 05.02.2019', evaItems3);

    let evaDoc = new EvaDoc({ evaCollection: [evaCollectionItem1, evaCollectionItem2] });
    evaDoc = evaDoc.merge(newEvaCollectionItem);

    expect(evaDoc.evaCollection.length).toBe(3);
    expect(evaDoc.evaCollection[2]).toEqual(newEvaCollectionItem);
  });

  it('should merge into existing empty doc with add', () => {
    const evaItems3 = [
      new EvaItem('D GK3', 'Eva Text 31'),
      new EvaItem('D GK4', 'Eva Text 32'),
    ];

    const newEvaCollectionItem = new EvaCollectionItem('Dienstag, 05.02.2019', evaItems3);

    let evaDoc = new EvaDoc();
    evaDoc = evaDoc.merge(newEvaCollectionItem);

    expect(evaDoc.evaCollection.length).toBe(1);
    expect(evaDoc.evaCollection[0]).toEqual(newEvaCollectionItem);
  });
});
