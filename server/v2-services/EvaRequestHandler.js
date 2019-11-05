const md5 = require('md5');
const LogService = require('../helper/LogService');
const VertretungsplanHelper = require('../helper/VertretungsplanHelper');
const EvaService = require('../functional-services/EvaService');

class EvaRequestHandler {
  static async process(req, res) {
    try {
      const statusCode = await VertretungsplanHelper.validateLogin(req);
      if (statusCode !== 200) {
        res.status(statusCode).end();
        return;
      }
    } catch (err) {
      const logService = new LogService();
      logService.logger.warn(`EvaRequestHandler could not validate login: ${err}`);
      res.status(503).end();
    }

    try {
      const evaService = new EvaService();
      const { grade, courseList, digest } = req.query;
      const evaItems = await evaService.getEvaItems(grade, courseList);
      const newDigest = md5(JSON.stringify(evaItems));

      if (process.env.DIGEST_CHECK === 'true' && newDigest === digest) {
        // noinspection JSUnresolvedFunction
        res.status(304).end();
      } else {
        // noinspection JSUnresolvedFunction
        res
          .status(200)
          .send({ evaData: evaItems, _digest: newDigest });
      }
    } catch (err) {
      const logService = new LogService();
      logService.logger.error(`EvaRequestHandler could not get EVA data: ${err}`);
      res.status(503).end();
    }
  }
}

module.exports = EvaRequestHandler;
