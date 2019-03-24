const md5 = require('md5');
const datetime = require('date-and-time');
const PostingsDb = require('../providers/PostingsDb');
const SubstitutionScheduleHashesDb = require('../providers/SubstitutionScheduleHashesDb');
const HtmlHelper = require('../helper/HtmlHelper');

/**
 * Processes requests on the posting we have published to the users.
 */
class PostingsHandler {
  constructor() {
    this.postingsDb = new PostingsDb();
    this.substitutionScheduleHashesDb = new SubstitutionScheduleHashesDb();
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
      const substitutionSchedule5A = await this.substitutionScheduleHashesDb.get('5A');
      const { substitutionSchedule: { _additionalText: additionalText } = { _additionalText: '' } } = substitutionSchedule5A;

      if (additionalText.length > 0) {
        const timestamp = `${datetime.format(new Date(substitutionSchedule5A.timestamp), 'YYYY-MM-DDTHH:mm:ss', true)}Z`;

        const additionalMessage = { timestamp, message: HtmlHelper.fontify(additionalText) };
        messages.unshift(additionalMessage);
      }

      const digest = md5(JSON.stringify(messages));

      if (process.env.DIGEST_CHECK === 'true' && digest === req.query.digest) {
        res.status(304).end();
      } else {
        res.status(200).send({ messages, _digest: digest });
      }
    } catch (err) {
      console.log(`Building postings failed: ${err}`);
      res.status(503).end();
    }
  }
}

module.exports = PostingsHandler;
