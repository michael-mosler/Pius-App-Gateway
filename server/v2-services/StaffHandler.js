const md5 = require('md5');
const LogService = require('../helper/LogService');
const { StaffDb } = require('../providers/StaffDb');

/**
 * This class services all App requests related to Staff dictionary.
 */
class StaffHandler {
  constructor() {
    this.logService = new LogService();
    this.staffDb = new StaffDb();
  }

  /**
   * Gets staff dictionary from database and sends it as result to App.
   * @param {Request} req Express request object
   * @param {ServerResponse} res Express response object
   */
  async process(req, res) {
    try {
      const staffDoc = await this.staffDb.get();
      const digest = md5(JSON.stringify(staffDoc));

      if (process.env.DIGEST_CHECK === 'true' && digest === req.query.digest) {
        res.status(304).end();
      } else {
        staffDoc.digest = digest;
        res.status(200).send(staffDoc);
      }
    } catch (err) {
      this.logService.logger.error(`Reading staff dictionary from database failed: ${err}`);
      res.status(500).end();
    }
  }
}

module.exports = StaffHandler;
