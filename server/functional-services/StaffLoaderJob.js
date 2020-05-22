const LogService = require('../helper/LogService');
const Config = require('../core-services/Config');
const { StaffLoader } = require('./StaffLoader');
const { StaffDb } = require('../providers/StaffDb');

/**
 * This class implements a staff loader job that can be run regularly
 * to update content of StaffDb.
 */
class StaffLoaderJob {
  constructor() {
    const config = new Config();
    this.staffLoader = new StaffLoader(`${config.piusBaseUrl}/internes/113/lehrer-und-mitarbeiter.html`);
    this.staffDb = new StaffDb();
    this.logService = new LogService();
  }

  /**
   * Runs the update job.
   * @returns {Promise<*>} - Always returns a resolved promise.
   */
  async run() {
    try {
      const staffFromWeb = await this.staffLoader.loadFromWeb();
      const staffDoc = await this.staffDb.get();
      staffDoc.staffDictionary = staffFromWeb.dictionary;
      return this.staffDb.insertDocument(staffDoc);
    } catch (err) {
      this.LogService.logger.error(`Updating staff db from StaffLoaderJob failed: ${err}`);
      return Promise.resolve();
    }
  }
}

module.exports = { StaffLoaderJob };
