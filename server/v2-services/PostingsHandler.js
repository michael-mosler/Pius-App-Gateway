const md5 = require('md5');
const PostingsDb = require('../PostingsDb');

/**
 * Processes requests on the posting we have published to the users.
 */
class PostingsHandler {
  constructor() {
    this.postingsDb = new PostingsDb();
  }

  /**
   * Send active postings. If digest is sent and postings have not changed HTTP status 304
   * is send. On error status 503 is returned.
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  async process(req, res) {
    try {
      const messages = await this.postingsDb.getPostings({ forDate: new Date() });
      const digest = md5(JSON.stringify(messages));

      if (process.env.DIGEST_CHECK === 'true' && digest === req.query.digest) {
        res.status(304).end();
      } else {
        res.status(200).send({ messages, _digest: digest });
      }
    } catch (err) {
      console.log(`Reading current postings failed: ${err}`);
      res.status(503).end();
    }
  }
}

module.exports = PostingsHandler;
