const LogService = require('../helper/LogService');

/**
 * This class implements a collection of housekeeping tasks.
 */
class HousekeepingJob {
  constructor() {
    this.logService = new LogService();
    this.extendedWinstonCloudant = LogService.cloudantTransport();
  }

  /**
   * Run all housekeeping tasks.
   * @todo Return number some statistics.
   */
  async run() {
    // If there is a Cloudant Winston transport delete outdated events.
    if (this.extendedWinstonCloudant) {
      try {
        this.logService.logger.info('... deleting outdated events');
        return this.extendedWinstonCloudant.housekeeping();
      } catch (err) {
        this.logService.logger.error(`HousekeepingJob failed: ${err}`);
      }
    } else {
      this.logService.logger.info('No Cloudant log transport available, skipping housekeeping.');
    }
    return Promise.resolve();
  }
}

module.exports = HousekeepingJob;
