const Cheerio = require('cheerio');
const { HtmlLoader } = require('../core-services/HtmlLoader');

/**
 * Employee, usually a teacher.
 * @property {String} shortHandSymbol - Shorthand symbol used in substitution schedule, e.g.
 * @property {String} name - Name
 * @property {String[]} subjects - Subjects covered
 */
class Employee {
  constructor(shortHandSymbol, name, subjects) {
    this.shortHandSymbol = shortHandSymbol;
    this.name = name;
    this.subjects = subjects;
  }
}

/**
 * All employees of the handled institution.
 * @property {Employee[]} employees - List of all employees.
 * @property {Object} dictionary - Object with one nested object for each shortHandSymbol.
 */
class Staff {
  constructor() {
    this.employees = [];
  }

  get dictionary() {
    const dict = {};
    this.employees.forEach(employee => {
      dict[employee.shortHandSymbol] = {
        name: employee.name,
        subjects: employee.subjects,
      };
    });
    return dict;
  }

  /**
   * Adds employee to staff.
   * @param {Employee} employee - Employee to add to staff list.
   */
  add(employee) {
    this.employees.push(employee);
  }
}

/**
 * Load staff list from Pius web page or from DB cache.
 */
class StaffLoader {
  constructor(fromUrl) {
    this.fromUrl = fromUrl;
    this.htmlLoader = new HtmlLoader(this.fromUrl);
  }

  /**
   * Extracts additonal staff data from DOM tree.
   * @param {*} $ DOM tree
   * @param {Staff} staff Staff object to start with.
   * @returns {Staff} Updated staff dictionary
   * @private
   */
  extractAdditionalStaffFromPage($, staff) {
    const trList = $('#main > div.entry > div:nth-child(6) > table').find('tbody > tr');
    trList.slice(3).each(function () {
      const siblings = [];
      $('td', $(this)).each(function () {
        siblings.push($(this).text());
      });

      if (siblings.length > 1) {
        const [name, shortHandSymbol] = siblings;
        staff.add(new Employee(shortHandSymbol, name, 'Betreuung'));
      }
    });

    return staff;
  }

  /**
   * Extract staf from DOM tree.
   * @param {*} $ DOM tree
   * @param {*} staff Staff object to start with.
   * @returns {Staff} Updated staff dictionary
   * @private
   */
  extractStaff($, staff) {
    const trList = $('#main > div.entry > table').find('tbody > tr');
    trList.slice(3).each(function () {
      const siblings = [];
      $('td', $(this)).each(function () {
        siblings.push($(this).text());
      });

      // For a data row we expect more than one td element.
      if (siblings.length > 1) {
        const [name, shortHandSymbol, subjectText] = siblings;
        const subjects = (subjectText || '')
          .split(',')
          .map(subject => subject.trim().replace(/\n.*/g, ''));

        staff.add(new Employee(shortHandSymbol, name, subjects));
      }
    });

    return staff;
  }

  /**
   * Extracts Staff from given document.
   * @param {String} data - Web page to extract staff from
   * @returns {Staff} - Staff object filled from document.
   * @throws {Error}
   * @private
   */
  extractStaffFromPage(data) {
    // Scan staff table.
    const strData = data
      .toString()
      .replace(/<br\/?>/g, '\n');

    const $ = Cheerio.load(strData);
    const staff = this.extractStaff($, new Staff());
    return this.extractAdditionalStaffFromPage($, staff);
  }

  /**
   * Load latest staff list from Pius website.
   * @returns {Promise<Staff|Error>} - Staff as loaded from website.
   */
  async loadFromWeb() {
    const data = await this.htmlLoader.load();
    return this.extractStaffFromPage(data);
  }
}

module.exports = { Employee, Staff, StaffLoader };
