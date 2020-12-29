const Cheerio = require('cheerio');
const { HtmlLoader } = require('../core-services/HtmlLoader');

/**
 * Employee, usually a teacher.
 * @property {String} shortHandSymbol - Shorthand symbol used in substitution schedule, e.g.
 * @property {String} name - Name
 * @property {String[]} subjects - Subjects covered
 * @property {Boolean} isTeacher - True if employee is listed as teacher
 * @property {String} email - E-Mail adress
 */
class Employee {
  constructor(shortHandSymbol, name, subjects, isTeacher, email = undefined) {
    this.shortHandSymbol = shortHandSymbol;
    this.name = name;
    this.subjects = subjects;
    this.isTeacher = isTeacher;
    this.email = email;
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
        isTeacher: employee.isTeacher,
        email: employee.email,
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
        staff.add(new Employee(shortHandSymbol, name, ['Betreuung'], false));
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
        // Check if we have found mailto node. If so
        // extract email address.
        const mailRef = $('a', $(this));
        if (mailRef.length === 0) {
          siblings.push($(this).text());
        } else {
          const mailTo = mailRef[0].attribs.href;
          siblings.push(mailTo.split(':')[1]);
        }
      });

      // For a data row we expect more than one td element.
      if (siblings.length > 1) {
        const [name, shortHandSymbol, subjectText, email] = siblings;
        const subjects = (subjectText || '')
          .split(',')
          .map(subject => subject.trim().replace(/\n.*/g, ''));

        staff.add(new Employee(shortHandSymbol, name, subjects, true, email));
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
