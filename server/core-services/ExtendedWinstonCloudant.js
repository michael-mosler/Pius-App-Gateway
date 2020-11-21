const async = require('async');
const datetime = require('date-and-time');
const clone = require('clone');
const CloudantTransport = require('winston-cloudant');

/**
 * This class adds some management functions to standard winston-cloudant
 * transport. It includes a retention period for log events as well as
 * limiting the total number of events kept in log table.
 *
 * @property {number} retention - Retention period in days
 * @property {number} maxEvents - Maximum number of events to keep (for future use)
 */
class ExtendedWinstonCloudant extends CloudantTransport {
  constructor(opts) {
    const retention = opts.retention;
    const maxEvents = opts.maxEvents;

    const _opts = clone(opts);
    delete _opts.retention;
    delete _opts.maxEvents;
    super(_opts);

    this.retention = retention;
    this.maxEvents = maxEvents;
    return this;
  }

  /**
   * Deletes log entries by given retention time.
   * @private
   * @throws
   */
  async deleteByRetention() {
    const now = new Date();
    const refDate = datetime.addDays(now, -this.retention);
    const filterDate = datetime.format(refDate, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
    const events = await this.db.find({
      selector: { 'params.@timestamp': { $lt: filterDate } },
      fields: ['_id', '_rev'],
    });

    await async.eachOfSeries(events.docs, async (doc) => {
      await new Promise(resolve => setTimeout(resolve, 125));
      try {
        await this.db.destroy(doc._id, doc._rev);
      } catch (err) { }
    });
  }

  /**
   * Delete outdated events in terms of configured
   * parameters. If retention as well as maxEvents is undefined
   * this function won't do anything.
   * @todo Return an array with error messages. Currently messages get lost. Return statistics on deleted docs.
   * @async
   * @throws
   */
  async housekeeping() {
    if (!this.retention && !this.maxEvents) {
      return Promise.resolve();
    }

    await this.deleteByRetention();
    return Promise.resolve();
  }
}

module.exports = ExtendedWinstonCloudant;
