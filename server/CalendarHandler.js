const NodeRestClient = require('node-rest-client').Client;
const Html2Json = require('html2json').html2json;
const md5 = require('md5');

const calendarURL = 'http://pius-gymnasium.de/internes/a/termine.html';

/**
 * A single day item from Calendar. Every items consists of an array with
 * datum at index 0 and event text at index 1.
 */
class DayItem {
    constructor() {
        this.detailItems = [];
    }
}

/**
 * All calendar items for a particular month.
 * @property {String} name - Name of the month.
 * @property {DayItem[]} currentDayItem - The latest day item that has been added.
 */
class MonthItem {
    constructor(name) {
        this.name = name;
        this.dayItems = [];
    }

    // noinspection JSUnusedGlobalSymbols
    get currentDayItem() {
        return this.dayItems[this.dayItems.length - 1];
    }
}

/**
 * The full Calendar.
 * @property {MonthItem} currentMonthItem - The latest month item that has been added.
 * @property {String} digest - MD5 hash value of core data
 */
class Calendar {
    constructor() {
        this.monthItems = [];
        this._digest = null;
    }

    // noinspection JSUnusedGlobalSymbols
    get currentMonthItem() {
        return this.monthItems[this.monthItems.length - 1];
    }

    get digest() {
        return this._digest;
    }

    set digest(value) {
        this._digest = value;
    }
}

class CalendarHandler {
    constructor() {
        this.client = new NodeRestClient();
        this.calendar = null;
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
        let newInitializer = initializer;

        if (json && json.node === 'text') {
            newInitializer = `${newInitializer} ${json.text}`;
        }

        if (json && json.child) {
            json.child.forEach((child) => {
                newInitializer = CalendarHandler.mergeSubTextItems(child, newInitializer);
            });
        }

        return newInitializer
            .replace(/[\r\t\n]/g, '')
            .trim();
    }

    /**
     * Adds a new month item to calendar from the given JSON object.
     * @param {Object} json - JSON object that contains month
     */
    addMonthFrom(json) {
        if (json.child) {
            json.child.forEach((child) => {
                if (child.node === 'text') {
                    this.calendar.monthItems.push(new MonthItem(child.text));
                }
            });
        }
    }

    /**
     * Adds all day items that are found in child array. Day items are identified by
     * classes <i>datum</i> and <i>meldung</i>.
     * @param {Object[]} childs - Array of JSON child nodes.
     */
    addDayItemFrom(childs) {
        childs.forEach((child) => {
           if (child.attr && child.attr.class === 'datum') {
               this.calendar.currentMonthItem.currentDayItem.detailItems.push(CalendarHandler.mergeSubTextItems(child));

           } else if (child.attr && child.attr.class === 'meldung') {
               this.calendar.currentMonthItem.currentDayItem.detailItems.push(CalendarHandler.mergeSubTextItems(child));
           }
        });
    }

    /**
     * Transforms the given DOM tree which is encoded as JSON into the format that is expected
     * by our App. Member property calendar finally contains the Calendar instance.
     * @param {Object} json - Current DOM node
     * @param {Object} parent - Parent DOM node
     */
    transform(json, parent) {
        if (json.tag === 'div' && json.attr && json.attr.class === 'monat' && json.child) {
            json.child.forEach((child) => {
               if (child.tag === 'h2' && child.child) {
                   this.addMonthFrom(json.child[0]);
               }
            });
        } else if (json.tag === 'div' && json.attr && json.attr.class === 'termin' && json.child) {
            this.calendar.currentMonthItem.dayItems.push(new DayItem());
            this.addDayItemFrom(json.child);
        }

        if (json.child) {
            json.child.forEach(child => this.transform(child, json));
        }
    }

    /**
     * Process one request on /calendar. It supports client side caching.
     * For this it computes an MD5 value for the result returned. Clients may pass
     * in this digest as digest parameter. If data is unchanged method sends a 304 HTTP status.
     * Otherwise on ok HTTP status 200 is returned. In case of an error appropriate HTTP
     * status is set.
     * @param {IncomingMessage} req - HTTP request
     * @param {ServerResponse} res - Response object
     */
    process(req, res) {
        // noinspection JSUnresolvedFunction
        this.client.get(calendarURL, (data, response) => {
            let json;
            if (response.statusCode === 200) {
                this.calendar = new Calendar();
                const strData = data.toString();
                const digest = md5(strData);
                json = Html2Json(strData);
                this.transform(json);

                // When not modified do not send any data but report "not modified".
                // noinspection JSUnresolvedVariable
                if (digest === req.query.digest) {
                    // noinspection JSUnresolvedFunction
                    res.status(304).end();
                } else {
                    this.calendar.digest = digest;
                    // noinspection JSUnresolvedFunction
                    res
                        .status(response.statusCode)
                        .send(this.calendar);
                }
            } else {
                // noinspection JSUnresolvedFunction
                res.status(response.statusCode).end();
            }
        });
    }
}

module.exports = CalendarHandler;
