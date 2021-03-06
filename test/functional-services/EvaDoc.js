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

  it('should not find collection item with extenstion', () => {
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
      new EvaItem('D G32', 'Eva Text 22'),
    ];

    const evaCollectionItem1 = new EvaCollectionItem('Freitag, 01.02.2019', evaItems1);
    const evaCollectionItem2 = new EvaCollectionItem('Montag, 04.02.2019', evaItems2);
    const newEvaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', evaItems3);

    const evaDoc = new EvaDoc({ evaCollection: [evaCollectionItem1, evaCollectionItem2] });
    expect(evaDoc.contains(newEvaCollectionItem)).toBeFalsy();
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

  it('should not find collection item in empty eva item list', () => {
    const evaItems3 = [
      new EvaItem('D GK3', 'Eva Text 31'),
      new EvaItem('D GK4', 'Eva Text 32'),
    ];

    const newEvaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', evaItems3);

    const evaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', []);
    const evaDoc = new EvaDoc({ evaCollection: [evaCollectionItem] });
    expect(evaDoc.contains(newEvaCollectionItem)).toBeFalsy();
  });

  it('should merge into existing doc with replace', () => {
    const e1 = new EvaItem('D GK1', 'Eva Text 11');
    const e2 = new EvaItem('D GK2', 'Eva Text 22');
    const e3 = new EvaItem('D GK3', 'Eva Text 31');
    const e4 = new EvaItem('D GK4', 'Eva Text 32');

    const evaItems1 = [
      new EvaItem('M GK1', 'Eva Text 11'),
      new EvaItem('M GK2', 'Eva Text 12'),
    ];

    const evaItems2 = [e3, e4];
    const evaItems3 = [e1, e2];
    const evaItems4 = [e1, e2, e3, e4];

    const evaCollectionItem1 = new EvaCollectionItem('Freitag, 01.02.2019', evaItems1);
    const evaCollectionItem2 = new EvaCollectionItem('Montag, 04.02.2019', evaItems2);
    const newEvaCollectionItem = new EvaCollectionItem('Montag, 04.02.2019', evaItems3);

    let evaDoc = new EvaDoc({ evaCollection: [evaCollectionItem1, evaCollectionItem2] });
    evaDoc = evaDoc.merge(newEvaCollectionItem);

    // Length of EVA Collection has not changed.
    expect(evaDoc.evaCollection.length).toBe(2);
    expect(evaDoc.evaCollection[1].evaItems.length).toBe(4);
    expect(evaDoc.evaCollection[1].evaItems).toEqual(evaItems4);
  });

  it('should merge into existing doc with eva item merge', () => {
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
