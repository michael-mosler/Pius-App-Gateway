const td = require('testdouble');
const expect = require('expect');
const fs = require('fs');
const { Employee, Staff } = require('../../server/functional-services/StaffLoader');

describe('Staff', () => {
  it('should convert into dictionary', () => {
    const staff = new Staff();
    staff.add(new Employee('aaa', 'Anton', ['LK', 'GK'], true, 'foo@bar.com'));
    staff.add(new Employee('bbb', 'Berta', ['GK'], false, 'bar@foo.com'));
    expect(staff.dictionary).toEqual(
      {
        aaa: { name: 'Anton', subjects: ['LK', 'GK'], isTeacher: true, email: 'foo@bar.com' },
        bbb: { name: 'Berta', subjects: ['GK'], isTeacher: false, email: 'bar@foo.com' },
      });
  });

  it('should convert empty staff list', () => {
    const staff = new Staff();
    expect(staff.dictionary).toEqual({ });
  });
});

describe('StaffLoader', () => {
  let HtmlLoader;
  let data;

  beforeEach(() => {
    const { HtmlLoader: _HtmlLoader } = td.replace('../../server/core-services/HtmlLoader');
    HtmlLoader = _HtmlLoader;

    try {
      data = fs.readFileSync('./test/functional-services/Mitarbeiter.html', { encoding: 'utf-8' });
    } catch (err) {
      console.log(err);
    }
  });

  afterEach(() => {
    td.reset();
  });

  it('should load Staff from web', async () => {
    td.when(HtmlLoader.prototype.load())
      .thenResolve(data);

    const { StaffLoader } = require('../../server/functional-services/StaffLoader');
    const staffLoader = new StaffLoader('/url');

    td.verify(new HtmlLoader('/url'));

    const d = await staffLoader.loadFromWeb();
    expect(d.constructor.name).toBe('Staff');
    expect(d.employees.length).toBe(91);
    expect(d.employees[0].shortHandSymbol).toBe('BSK');
    expect(d.employees[0].name).toBe('Stephanie Baaske');
    expect(d.employees[0].subjects).toEqual(['Französisch', 'Spanisch']);
    expect(d.employees[0].isTeacher).toBe(true);
    expect(d.employees[0].email).toBe('s.baaske@pius-gymnasium.de');
    expect(d.employees[85].shortHandSymbol).toBe('WD');
    expect(d.employees[85].name).toBe('Florian Wunder');
    expect(d.employees[85].subjects).toEqual(['Latein', 'Sport']);
    expect(d.employees[85].email).toBe('f.wunder@pius-gymnasium.de');
    expect(d.employees[90].name).toBe('Ruth Rijsdijk');
    expect(d.employees[90].shortHandSymbol).toBe('RIJ');
    expect(d.employees[90].subjects).toEqual(['Betreuung']);
    expect(d.employees[90].isTeacher).toBe(false);
    expect(d.employees[90].email).toBeUndefined();
  });
});
