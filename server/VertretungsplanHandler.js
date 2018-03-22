const NodeRestClient = require('node-rest-client').Client;
const Html2Json = require('html2json').html2json;

class VertretungsplanItem {
    constructor() {
        this.detailItems = [];
    }
}

/**
 *
 */
class GradeItem {
    constructor(grade) {
        this.grade = grade;
        this.vertretungsplanItems = [];
    }

    get currentVertretungsplanItem() {
        return this.vertretungsplanItems[this.vertretungsplanItems.length - 1];
    }
}

/**
 *
 */
class DateItem {
    constructor(title) {
        this.title = title
            .replace('Vertretungs- und Klausurplan f&uuml;r ', '')
            .replace('den ', '');
        this.gradeItems = [];
    }

    get currentGradeItem() {
        return this.gradeItems[this.gradeItems.length - 1];
    }
}

/**
 *
 */
class Vertretungsplan {
    constructor() {
        this.tickerText = '';
        this._additionalText = '';
        this.lastUpdate = '';
        this.dateItems = [];
    }

    set additionalText(value) {
        this._additionalText = `${this._additionalText} ${value}`.trim();
    }

    get currentDateItem() {
        return this.dateItems[this.dateItems.length - 1];
    }
}

class VertretungsplanHandler {
    constructor() {
        this.client = new NodeRestClient();
        this.vertretungsplan = null;
    }

    /**
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
     *
     * @param json
     * @returns {*}
     */
    transform(json, isInItemList = false) {
        if (json.node === 'text' && json.text.match(/^Vertretungs- und Klausurplan/)) {
            this.vertretungsplan.dateItems.push(new DateItem(json.text));
        }
        else if (json.node === 'text' && json.text.match(/Letzte Aktualisierung:/)) {
            this.vertretungsplan.lastUpdate = json.text.replace(/[()]/g, '');
        }
        else if (json.node === 'text' && json.text.match(/^Heute ist/)) {
            this.vertretungsplan.tickerText = json.text;
        }
        else if (json.node === 'text' && json.text.match(/^((\d[A-E])|(Q[12])|(EF)|(IK))/)) {
            this.vertretungsplan.currentDateItem.gradeItems.push(new GradeItem(json.text));
        }
        else if (json.attr && json.attr.class instanceof Array && json.attr.class[0] === 'vertretung' && json.attr.class[1] === 'neu') {
            const text = VertretungsplanHandler.mergeSubTextItems(json);
            this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.push(text.replace(/\s\s+/, ' '))
            isInItemList = true;
        }
        else if (json.attr && json.attr.class instanceof Array && json.attr.class[0] === 'eva') {
            const text = VertretungsplanHandler.mergeSubTextItems(json);
            this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.push(text.replace(/\s\s+/, ' '))
        }
        else if (json.attr && json.attr.class === 'vertretung') {
            const text = VertretungsplanHandler.mergeSubTextItems(json);
            this.vertretungsplan.currentDateItem.currentGradeItem.currentVertretungsplanItem.detailItems.push(text.replace(/\s\s+/, ' '))
            isInItemList = true;
        }
        else if (json.node === 'text' && this.vertretungsplan.tickerText && this.vertretungsplan.dateItems.length === 0) {
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

                this.transform(child, isInItemList);
            });
        }

        return json;
    }

     /**
     *
     * @param req
     * @param res
     */
    process(req, res) {
        const base64encodedData = new Buffer('Papst' + ':' + 'PiusX').toString('base64');

        this.client.get('http://pius-gymnasium.de/vertretungsplan/', {
            headers: {
                'Authorization': 'Basic ' + base64encodedData
            }
        }, (data, response) => {
            let json;
            if (response.statusCode === 200) {
                this.vertretungsplan = new Vertretungsplan();
                json = Html2Json(data.toString('utf8'));
                json = this.transform(json);
            }
            res
                .status(response.statusCode)
                .send(this.vertretungsplan);
        });
    }
}

module.exports = VertretungsplanHandler;