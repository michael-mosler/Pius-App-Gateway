const request = require('request');
// noinspection JSUnresolvedVariable
const Html2Json = require('html2json').html2json;
const md5 = require('md5');
const clone = require('clone');
const LogService = require('../helper/LogService');
const VertretungsplanHelper = require('../helper/VertretungsplanHelper');
const PushEventEmitter = require('../functional-services/PushEventEmitter');
const Config = require('../core-services/Config');
const BasicAuthProvider = require('../providers/BasicAuthProvider');
const SubstitionScheduleHashessDb = require('../providers/SubstitutionScheduleHashesDb');

const vertretungsplanURL = 'https://pius-gymnasium.de/vertretungsplan/';

// Regular grades to keep. There may be some "grades" we do not want to keep.
// In the past, accidently "AUFS" was used which is not of any meaning to us.
const allValidGradesPattern = new RegExp('^((\\d[A-E])|(Q[12])|(EF)|(IK)|(VT)|(HW))');
const allExistingGradesPattern = new RegExp('^((\\d[A-E])|(Q[12])|(EF)|(IK)|(VT)|(HW)|(AUFS))');

/**
 * A single Vertretungsplan item. Every item consists of a set of properties that are
 * simply lisated in detailItems array.
 */
class VertretungsplanItem {
  constructor() {
    this.detailItems = [];
    // this.vertretungsplan = new Vertretungsplan();
  }

  /**
   * Returns EVA text or undefined when there is no EVA text.
   * @returns {String|undefined}
   */
  get evaText() {
    return this.detailItems[7];
  }

  /**
   * Checks if detail items are in new format, i.e. "Aktueller Lehrer" property
   * has been removed.
   * @returns {Boolean}
   */
  get hasNewDetailItemFormat() {
    // When EVA text is present we expect 8 items in old format.
    if (this.evaText && this.detailItems.length < 8) {
      return true;
    }

    // Otherwise we expect 7 items in old format.
    return this.detailItems.length < 7;
  }
}

/**
 * The Vertretungsplan for a certain Grade.
 * @property {VertretungsplanItem} currentVertretungsplanItem - Latest VertretungsplanItem that has been added.
 */
class GradeItem {
  constructor(grade) {
    this.grade = grade;
    this.vertretungsplanItems = [];
  }

  /**
   * Get latest VertretungsplanItem that has been added.
   * @returns {VertretungsplanItem}
   */
  get currentVertretungsplanItem() {
    return this.vertretungsplanItems[this.vertretungsplanItems.length - 1];
  }
}

/**
 * The Vetretungsplan for a certain Date.
 * @property {GradeItem} currentGradeItem - Latest grade item that has been added.
 * @property {String} digest - MD5 hash value of core data
 */
class DateItem {
  constructor(title) {
    // noinspection JSUnusedGlobalSymbols
    this.title = title
      .replace('Vertretungs- und Klausurplan f&uuml;r ', '')
      .replace('den ', '');
    this.gradeItems = [];
  }

  /**
   * Get latest grade item that has been added.
   * @returns {GradeItem}
   */
  get currentGradeItem() {
    return this.gradeItems[this.gradeItems.length - 1];
  }
}

/**
 * Base class for convertred Vertretungsplan. An instance of this calss will be jsonfied
 * and then sent as result to out App.
 * @property {String} digest - MD5 digest of the current content.
 * @property {String} additionalText - Content of additional text fields of web page.
 * @property {DateItem} currentDateItem - Latest date item that has been added.
 */
class Vertretungsplan {
  constructor() {
    this.tickerText = '';
    this._additionalText = '';
    // noinspection JSUnusedGlobalSymbols
    this.lastUpdate = '';
    this.dateItems = [];
    this._digest = null;
  }

  /**
   * @returns {String}
   */
  get digest() {
    return this._digest;
  }

  /**
   * @param {String} value
   */
  set digest(value) {
    this._digest = value;
  }

  /**
   * @param {String} value
   */
  set additionalText(value) {
    this._additionalText = `${this._additionalText} ${value}`.trim();
  }

  // noinspection JSUnusedGlobalSymbols
  get currentDateItem() {
    return this.dateItems[this.dateItems.length - 1];
  }

  /**
   * Converts instance by filtering content for a given grade.
   * @param {String|RegExp} forGrades - Grades to filter for. If of type string must be a valid regular expression.
   */
  filter(forGrades) {
    if (!forGrades) {
      return;
    }

    const pattern = typeof forGrades === 'string' ? new RegExp(forGrades) : forGrades;
    this.dateItems.forEach((date) => {
      date.gradeItems = date.gradeItems.filter(gradeItem => gradeItem.grade.match(pattern));
    });
  }
}

/**
 * This class handles a single request to /vertretungsplan. process() method must be called
 * to start processing.
 * <b>Important</b>
 * Currently process() method is not reentrant, thus for every request a new instance of this
 * class must be created. This behaviour is likely to be changed in near future.
 */
class VertretungsplanHandler {
  /**
   * Instantiate a VetretungsplanHandler for the designated version.
   * @param {String} [version='v1'] - Requested version
   */
  constructor(version = 'v1') {
    this.logService = new LogService();
    this.request = request;
    this.version = version;
    this.vertretungsplan = new Vertretungsplan();
  }

  /**
   * The method merges texts that are scattered over several DOM nodes into a single sub-text
   * item.
   * @param {Object} json - DOM tree node that contains the sub-tree to be merged.
   * @param {String} [initializer=''] - Content that has been collected so far
   * @returns {String}
   * @private
   * @static
   */
  static mergeSubTextItems(json, initializer = '') {
    if (!json) {
      return initializer;
    }

    let newInitializer = initializer;
    if (json.node === 'text') {
      newInitializer = `${newInitializer} ${json.text}`;
    }

    if (json.child) {
      json.child.forEach((child) => {
        newInitializer = VertretungsplanHandler.mergeSubTextItems(child, newInitializer);
      });
    }

    return newInitializer;
  }

  /**
   * Transforms the given DOM tree which is encoded as JSON into the format that is expected
   * by our App. Member property vertretungsplan finally contains the transformed Vertretungsplan
   * instance.
   * @TODO: Replace property vertretungsplan by volatile variable. This would make process method reentrant.
   * @param {Object} json - Current DOM node
   * @param {Object} parent - Parent DOM node
   */
  transform(json, parent) {
    if (json.node === 'text' && json.text.match(/^Vertretungs- und Klausurplan/)) {
      // Skip repeated items which might occur due to a bug on Pius web site.
      const dateItem = new DateItem(json.text);
      if (this.vertretungsplan.currentDateItem && dateItem.title === this.vertretungsplan.currentDateItem.title) {
        return;
      } else {
        this.vertretungsplan.dateItems.push(new DateItem(json.text));
      }
    } else if (json.node === 'text' && json.text.match(/Letzte Aktualisierung:/) && !this.vertretungsplan.lastUpdate) {
      this.vertretungsplan.lastUpdate = json.text.replace(/[()]/g, '');

      // For API versions starting from v2 remove "Letzte Aktualisierung" from result.
      if (this.version >= 'v2') {
        this.vertretungsplan.lastUpdate = this.vertretungsplan.lastUpdate.replace(/\s*Letzte Aktualisierung:\s*/, '');
      }
    } else if (json.node === 'text' && json.text.match(/^Heute ist/)) {
      this.vertretungsplan.tickerText = json.text;
    } else if ((parent && parent.tag === 'th') && json.node === 'text' && json.text.match(allExistingGradesPattern)) {
      this.vertretungsplan.currentDateItem.gradeItems.push(new GradeItem(json.text));
    } else if (json.attr && json.attr.class instanceof Array && json.attr.class[0] === 'vertretung' && json.attr.class[1] === 'neu') {
      let text = VertretungsplanHandler.mergeSubTextItems(json);
      const indexOfCurrentDetailItem = this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.length;

      // Sondereinsatz with incomplete course specification. In this case in our terms this is inconsistent. We fix it
      // by removing the course.
      if (indexOfCurrentDetailItem === 2) {
        if (text.length < 3 && this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems[1].trim() === 'Sondereinsatz') {
          text = '';
        }
      }

      this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.push(text.replace(/\s\s+/, ' '));
    } else if (json.attr && json.attr.class instanceof Array && json.attr.class[0] === 'eva') {
      const text = VertretungsplanHandler.mergeSubTextItems(json);
      this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.push(text.replace(/\s\s+/, ' '));
    } else if (json.attr && json.attr.class === 'vertretung') {
      let text = VertretungsplanHandler.mergeSubTextItems(json);
      const indexOfCurrentDetailItem = this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.length;

      // Sondereinsatz with incomplete course specification. In this case in our terms this is inconsistent. We fix it
      // by removing the course.
      if (indexOfCurrentDetailItem === 2) {
        if (text.trim().length < 3 && this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems[1].trim() === 'Sondereinsatz') {
          text = '';
        }
      }

      this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.push(text.replace(/\s\s+/, ' '));
    } else if (json.node === 'text' && this.vertretungsplan.tickerText && this.vertretungsplan.dateItems.length === 0) {
      this.vertretungsplan.additionalText = json.text;
    }

    if (json.child) {
      json.child.forEach((child) => {
        // This check tests if a new Vertretungsplan item for the current grade and date is started by the
        // current child. If so another item is pushed onto item list.
        let index = -1;
        if (child.node === 'element' && child.tag === 'tr') {
          index = child.child.findIndex(grandChild => (grandChild.attr && grandChild.attr.class === 'vertretung'));
          if (index > -1) {
            this.vertretungsplan.currentDateItem.currentGradeItem.vertretungsplanItems.push(new VertretungsplanItem());
          }
        }

        this.transform(child, json);

        // ****************************************************************************************************
        // Check for new format as of March, 2nd 2019. Column "Aktueller Lehrer" is removed.
        // This, total number of detail items is decreased by 1. To prevent app from crashing
        // we need to add it as blank array item.
        const { currentDateItem: { currentGradeItem: { currentVertretungsplanItem } = {} } = {} } = this.vertretungsplan;
        if (index > -1 && currentVertretungsplanItem && currentVertretungsplanItem.hasNewDetailItemFormat) {
          currentVertretungsplanItem.detailItems.splice(5, 0, ' ');
        }
        // ****************************************************************************************************
      });
    }
  }

  /**
   * Process one request on /vertretungsplan. The method supports filtering by a certain
   * grade which needs to be passed in forGrade parameter. It also supports client side
   * caching. For this it computes an MD5 value for the result returned. Clients may pass
   * in this digest as digest parameter. If data is unchanged method sends a 304 HTTP status.
   * Otherwise on ok HTTP status 200 is returned. In case of an error appropriate HTTP
   * status is set.
   * Calling this method requires basic authentication. Authentication data is forwarded
   * to Pius HTTP server for validation. The method itself does not know about correct
   * username and password. If authentication fails as usual client will receive a 401
   * status code.
   * @param {IncomingMessage} req - HTTP request
   * @param {ServerResponse} res - Response object
   */
  process(req, res) {
    // Hack: Make sure that new logins are being used.
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (username === 'Papst' && password === 'PiusX') {
      this.logService.logger.info('Old credentials detected when requesting /vertretungsplan! Sending immediate 401.');
      res.status(401).end();
      return;
    }

    // noinspection JSUnresolvedFunction
    this.request.get(vertretungsplanURL, {
      headers: {
        Authorization: req.header('authorization'),
      },
    }, (error, response, data) => {
      if (error) {
        this.logService.logger.error(`Failed to load substition schedule: ${error}`);
        res.status(503).end();
      } else if (response.statusCode === 200) {
        try {
          const strData = data.toString();
          const digest = md5(strData);

          // When not modified do not send any data but report "not modified".
          // noinspection JSUnresolvedVariable
          if (process.env.DIGEST_CHECK === 'true' && digest === req.query.digest) {
            res.status(304).end();
          } else {
            const json = Html2Json(strData);
            this.transform(json);

            // noinspection JSUnresolvedVariable
            this.vertretungsplan.filter(req.query.forGrade || allValidGradesPattern);
            this.vertretungsplan.digest = digest;
            res
              .status(response.statusCode)
              .send(this.vertretungsplan);
          }
        } catch (err) {
          this.logService.logger.error(`Error when transforming substitution schedule: ${err}`);
          res.status(500).end();
        }
      } else {
        res.status(response.statusCode).end();
      }
    });
  }

  /**
   * This method requests the latest substitution schedule and extracts sub-schedule for all
   * registered grades. It then computes MD5 hash for each of these sub-schedules and
   * compares it to the one stored in backing store. When a change is detected it fires
   * a push-event which receives the grade for which an event was detected and the MD5
   * hash that apps should have locally to be to date.
   */
  checker() {
    this.logService.logger.info('##### Checking for new changes to push...');
    const pushEventEmitter = new PushEventEmitter();
    const basicAuthProvider = new BasicAuthProvider();

    basicAuthProvider.getAuthInfo()
      .then((authInfo) => {
        this.request.get(vertretungsplanURL, {
          headers: {
            Authorization: `Basic ${authInfo}`,
          },
        }, (error, response, data) => {
          if (error) {
            this.logService.logger.error(`Failed to load substitution schedule for checker: ${error}`);
          } else if (response.statusCode === 200) {
            try {
              const substitionScheduleHashessDb = new SubstitionScheduleHashessDb();
              const strData = data.toString();

              const json = Html2Json(strData);
              this.transform(json);

              const checkList = [];
              Config.grades.forEach((grade) => {
                // Clone vertretungsplan as filter() modifies it in place.
                const filteredVertretungsplan = clone(this.vertretungsplan);
                filteredVertretungsplan.filter(grade);

                // Compute sub-hash for this special schedule and put it on our list.
                const subHash = md5(JSON.stringify(filteredVertretungsplan));
                checkList.push({ grade, hash: subHash, substitutionSchedule: filteredVertretungsplan });
              });

              // Cross check our list and emit push event for all items which have changed.
              substitionScheduleHashessDb.crossCheck(checkList)
                .then((changeList) => {
                  changeList.forEach(item => pushEventEmitter.emit('push', item));
                })
                .catch((err) => {
                  this.logService.logger.error(`Checker failed with a rejected promise when cross checking: ${err}`);
                });
            } catch (err) {
              this.logService.logger.error(`Error when transforming substitution schedule for checker: ${err}`);
            }
          } else {
            this.logService.logger.error(`Checker failed to get latest data with status ${response.statusCode}\n`);
          }
        });
      })
      .catch((err) => {
        this.logService.logger.error(`Check failed with a rejected promise: ${err}\n`);
      });

    this.logService.logger.info('##### Checking for new changes to push... DONE');
  }

  /**
   * The method validates login information that is given as basic authentication data.
   * The data is checked by sending a HEAD request to Pius web site for URL /vertretungsplan.
   * The HTTP status code simply is returned to App.
   * @param {IncomingMessage} req - HTTP request object
   * @param {ServerResponse} res - Server response object
   */
  async validateLogin(req, res) {
    try {
      const statusCode = await VertretungsplanHelper.validateLogin(req);
      res.status(statusCode).end();
    } catch (err) {
      this.logService.logger.warn(`VertretungsplanHandler could not validate login: ${err}`);
      res.status(503).end();
    }
  }
}

module.exports = VertretungsplanHandler;
