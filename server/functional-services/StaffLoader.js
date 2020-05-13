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
   * Extracts Staff from given document.
   * @param {String} data - Web page to extract staff from
   * @returns {Staff} - Staff object filled from document.
   * @throws {Error}
   * @private
   */
  extractStaffFromPage(data) {
    const staff = new Staff();

    // Scan staff table.
    const $ = Cheerio.load(data.toString());
    const table = $('#main > div.entry > table');
    table.find('tbody > tr').slice(3).each(function () {
      const siblings = [];
      $('td', $(this)).each(function () {
        siblings.push($(this).text());
      });

      // For a data row we expect more than one td element.
      if (siblings.length > 1) {
        const [name, shortHandSymbol, subjectText] = siblings;
        const subjects = (subjectText || '')
          .trim()
          .replace(/ +/g, '')
          .replace(/\n.*/g, '')
          .split(',');

        staff.add(new Employee(shortHandSymbol, name, subjects));
      }
    });

    return staff;
  }

  async loadFromWeb() {
    const data = await this.htmlLoader.load();
    return this.extractStaffFromPage(data);
  }
}

module.exports = { Employee, Staff, StaffLoader };
