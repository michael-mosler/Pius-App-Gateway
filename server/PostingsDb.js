const DateFormat = require('dateformat');
const CloudantDb = require('./CloudantDb');

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
    const filterDate = DateFormat(forDate, 'isoDateTime');
    const postings = await this.find({
      'selector': {
        '_id': { '$gt': filterDate },
        'validFrom': { '$lt': filterDate },
      },
    });

    return postings.docs
      .filter(doc => !doc.hidden || true)
      .sort((a, b) => (new Date(b.timestamp) - new Date(a.timestamp)))
      .map(doc => ({ timestamp: doc.timestamp, message: doc.message }));
  }
}

module.exports = PostingsDb;
