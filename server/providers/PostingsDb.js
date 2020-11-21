const datetime = require('date-and-time');
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
   * Gets all active postings for a given date. If a target is given all messages for the given target plus
   * all messages without any target set are returned.
   * @param {Date} forDate - Get all postings that are active for this date.
   * @param {String} forTarget - Get messages for target. When null then all messages without any target are returned.
   * @returns {Promise<Object|Error>} Resolves to a list of documents with timestamp and message property.
   */
  async getPostings({ forDate, forTarget }) {
    const filterDate = datetime.format(forDate, 'YYYY-MM-DDTHH:mm:ss');
    const postings = await this.find({
      selector: {
        _id: { $gt: filterDate },
        validFrom: { $lt: filterDate },
        $or: [
          { target: { $exists: false } },
          { target: { $regex: forTarget || '.*' } },
        ],
      },
    });

    return postings.docs
      .filter(doc => doc.hidden === null || !doc.hidden)
      .sort((a, b) => (new Date(b.timestamp) - new Date(a.timestamp)))
      .map(doc => ({ timestamp: doc.timestamp, message: HtmlHelper.fontify(doc.message) }));
  }
}

module.exports = PostingsDb;
