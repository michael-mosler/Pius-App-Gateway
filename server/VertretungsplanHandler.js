const NodeRestClient = require('node-rest-client').Client;
// noinspection JSUnresolvedVariable
const Html2Json = require('html2json').html2json;
const request = require('request');
const md5 = require('md5');
const clone = require('clone');
const PushEventEmitter = require('./PushEventEmitter');

const Config = require('./Config');
const BasicAuthProvider = require('./BasicAuthProvider');
const SubstitionScheduleHashessDb = require('./SubstitutionScheduleHashesDb');

const vertretungsplanURL = 'http://pius-gymnasium.de/vertretungsplan/';

/**
 * A single Vertretungsplan item. Every item consists of a set of properties that are
 * simply lisated in detailItems array.
 */
class VertretungsplanItem {
  constructor() {
    this.detailItems = [];
    // this.vertretungsplan = new Vertretungsplan();
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

  get digest() {
    return this._digest;
  }

  set digest(value) {
    this._digest = value;
  }

  set additionalText(value) {
    this._additionalText = `${this._additionalText} ${value}`.trim();
  }

  // noinspection JSUnusedGlobalSymbols
  get currentDateItem() {
    return this.dateItems[this.dateItems.length - 1];
  }

  /**
   * Converts instance by filtering content for a given grade.
   * @param {String} forGrade - Grade to filter for.
   */
  filter(forGrade) {
    if (!forGrade) {
      return;
    }

    this.dateItems.forEach((date) => {
      const index = date.gradeItems.findIndex(gradeItem => gradeItem.grade === forGrade);
      if (index === -1) {
        date.gradeItems = [];
      } else {
        date.gradeItems = [date.gradeItems[index]];
      }
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
    this.client = new NodeRestClient();
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
   * @param {Boolean} isInItemList - True when itemList is parsed
   */
  transform(json, parent, isInItemList = false) {
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
    } else if ((parent && parent.tag === 'th') && json.node === 'text' && json.text.match(/^((\d[A-E])|(Q[12])|(EF)|(IK)|(VT)|(HW))/)) {
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
      isInItemList = true;
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
      isInItemList = true;
    } else if (json.node === 'text' && this.vertretungsplan.tickerText && this.vertretungsplan.dateItems.length === 0) {
      this.vertretungsplan.additionalText = json.text;
    }

    if (json.child) {
      json.child.forEach((child) => {
        // This check tests if a new Vertretungsplan item for the current grade and date is started by the
        // current child. If so another item is pushed onto item list.
        if (child.node === 'element' && child.tag === 'tr') {
          const index = child.child.findIndex(grandChild => (grandChild.attr && grandChild.attr.class === 'vertretung'));
          if (index > -1) {
            this.vertretungsplan.currentDateItem.currentGradeItem.vertretungsplanItems.push(new VertretungsplanItem());
          }
        }

        this.transform(child, json, isInItemList);
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
    // noinspection JSUnresolvedFunction
    this.client.get(vertretungsplanURL, {
      headers: {
        'Authorization': req.header('authorization'),
      },
    }, (data, response) => {
      if (response.statusCode === 200) {
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
          this.vertretungsplan.filter(req.query.forGrade);
          this.vertretungsplan.digest = digest;
          res
            .status(response.statusCode)
            .send(this.vertretungsplan);
        }
      } else {
        res.status(response.statusCode).end();
      }
    })
      .on('requestTimeout', (err) => {
        console.log(`Get request on substitution schedule has timed out: ${err}`);
        res.status(408).end();
      })
      .on('responseTimeout', (err) => {
        console.log(`Get response on substitution schedule has timed out: ${err}`);
        res.status(408).end();
      })
      .on('error', (err) => {
        console.log(`Error when getting substitution schedule: ${err}`);
        res.status(503).end();
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
    console.log('##### Checking for new changes to push...');
    const pushEventEmitter = new PushEventEmitter();
    const basicAuthProvider = new BasicAuthProvider();

    basicAuthProvider.getAuthInfo()
      .then((authInfo) => {
        this.client.get(vertretungsplanURL, {
          headers: {
            'Authorization': `Basic ${authInfo}`,
          },
        }, (data, response) => {
          if (response.statusCode === 200) {
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
                console.log(`Checker failed with a rejected promise when cross checking: ${err}`);
              });
          } else {
            console.log(`Checker failed to get latest data with status ${response.statusCode}\n`);
          }
        })
          .on('requestTimeout', (err) => {
            console.log(`Get request on substitution schedule has timed out: ${err}`);
            console.log('Skipping this push run.');
          })
          .on('responseTimeout', (err) => {
            console.log(`Get response on substitution schedule has timed out: ${err}`);
            console.log('Skipping this push run.');
          })
          .on('error', (err) => {
            console.log(`Error when getting substitution: ${err}`);
            console.log('Skipping this push run.');
          });
      })
      .catch((err) => {
        console.log(`Check failed with a rejected promise: ${err}\n`);
      });

    console.log('##### Checking for new changes to push... DONE');
  }

  /**
   * The method validates login information that is given as basic authentication data.
   * The data is checked by sending a HEAD request to Pius web site for URL /vertretungsplan.
   * The HTTP status code simply is returned to App.
   * @param {IncomingMessage} req - HTTP request object
   * @param {ServerResponse} res - Server response object
   */
  validateLogin(req, res) {
    const options = {
      url: 'http://pius-gymnasium.de/vertretungsplan/',
      headers: {
        'Authorization': req.header('authorization'),
      },
    };

    request.head(options, (err, response) => { // eslint-disable-line handle-callback-err
      res.status(response.statusCode).end();
    });
  }
}

module.exports = VertretungsplanHandler;
