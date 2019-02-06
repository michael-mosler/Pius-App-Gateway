const datetime = require('date-and-time');
const Config = require('../core-services/Config');
const CloudantDb = require('../core-services/CloudantDb');
const HtmlHelper = require('../helper/HtmlHelper');

/**
 * Implemnents access to our postings db.
 */
class PostingsDb extends CloudantDb {
  constructor() {
    super('postings', true);
  }

  /**
   * Gets all active postings for a given date.
   * @param {Date} forDate - Get all postings that are active for this date.
   * @returns {Promise<[Object]|Error>} Resolves to a list of documents with timestamp and message property.
   */
  async getPostings({ forDate }) {
    const filterDate = datetime.format(forDate, Config.isoDateTime);
    const postings = await this.find({
      'selector': {
        '_id': { '$gt': filterDate },
        'validFrom': { '$lt': filterDate },
      },
    });

    return postings.docs
      .filter(doc => doc.hidden === null || !doc.hidden)
      .sort((a, b) => (new Date(b.timestamp) - new Date(a.timestamp)))
      .map(doc => ({ timestamp: doc.timestamp, message: HtmlHelper.fontify(doc.message) }));
  }
}

module.exports = PostingsDb;
