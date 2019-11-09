const md5 = require('md5');
const datetime = require('date-and-time');
const LogService = require('../helper/LogService');
const PostingsDb = require('../providers/PostingsDb');
const SubstitutionScheduleHashesDb = require('../providers/SubstitutionScheduleHashesDb');
const HtmlHelper = require('../helper/HtmlHelper');

/**
 * Processes requests on the posting we have published to the users.
 */
class PostingsHandler {
  constructor() {
    this.logService = new LogService();
    this.postingsDb = new PostingsDb();
    this.substitutionScheduleHashesDb = new SubstitutionScheduleHashesDb();
  }

  /**
   * Gets target of the postings request. There are 2 possible results, obviously.
   * 1) iOS or
   * 2) Android
   * If no target can be derived the function returns null.
   * @param {IncomingMessage} req - Incoming request from express with useragent object attached.
   * @returns {'iOS'|'android'|null} Source derived from req.useragent.target which is one of targets.
   */
  target(req) {
    if (!req.useragent) {
      return null;
    }

    const source = req.useragent.source;

    // iOS
    // Check for iOS. In this case source is somewhat like
    // Pius-App/1 CFNetwork/978.0.7 Darwin/18.7.0.
    // We are interested only in "Darwin" as this identifies iOS.
    if (source.match(/^.* Darwin\/\d.*$/)) {
      return 'iOS';
    }

    // Android
    // Check for Android. In this case source should look like
    // Dalvik/2.1.0 (Linux; U; Android 8.1.0; Android SDK built for x86 Build/OSM1.180201.031
    // We go for "Android".
    if (source.match(/^.* Android .*$/)) {
      return 'android';
    }

    this.logService.logger.warn(`Failed to derive target from source ${req.useragent.source}.`);
    return null;
  }

  /**
   * Send active postings. If digest is sent and postings have not changed HTTP status 304
   * is send. On error status 503 is returned.
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  async process(req, res) {
    try {
      const target = this.target(req);
      this.logService.logger.debug(`Postings from source ${req.useragent.source} requested. Derived target ${target || '<unknown>'}.`);

      const messages = await this.postingsDb.getPostings({ forDate: new Date(), forTarget: target });
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
      this.logService.logger.error(`Building postings failed: ${err}`);
      res.status(503).end();
    }
  }
}

module.exports = PostingsHandler;
