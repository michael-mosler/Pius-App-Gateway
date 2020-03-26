const CloudantDb = require('../../core-services/CloudantDb');

/**
 * Implements access to debug-schedules db.
 */
class DebugSchedulesDb extends CloudantDb {
  constructor() {
    super('debug-schedules', true);
  }
}

module.exports = DebugSchedulesDb;
