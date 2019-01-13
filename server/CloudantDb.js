/* eslint-disable max-len */
const Verror = require('verror');
const asyncRetry = require('async-retry');
const Connection = require('./CloudantConnection');

const retryOptions = {
  retries: 15,
  factor: 1.4,
  minTimeout: 200,
  maxTimeout: 5000,
  randomize: true,
};

/**
 * Database Driver class for Cloudant. This class the API that is exported by {@link Database}
 * to the middleware service. The middleware must not make use of Cloudant API directly but
 * needs to use the database abstraction layer instead. This ensures that the DBMS used
 * is interchangeable.
 * @property {String} type - Type of this driver: "Cloudant Driver"
 */
class CloudantDb {
  /**
   * Connect to a particular Cloudant database (which would be called table in traditional RDBM
   * Systems.
   * @param {string} name - The name of the database
   * @param {boolean} [connect=true] - if true connection to database is established immediately
   */
  constructor(name, connect = true) {
    // noinspection Annotator
    this.connection = new Connection();
    this.handle = this.connection.connect();
    this.name = name;
    this.connected = false;
    this.db = null;

    if (connect) {
      this.connect();
    }
  }

  /**
   * Default error handler for execWithRetry. In case of too_many_requests error the function retries, all other abort retrying.
   * @param {Function} bail - Bail function; calling this will abort retrying.
   * @param {Error} err - Reported error
   * @param {Object} info - Info object for the operation. Currently only property name should exist.
   * @throws {Error}
   * @private
   */
  defaultOnError(bail, err, info) {
    if (err.statusCode === 429) {
      // Too many requests, provisioned limit exceeded; throw error which will cause a retry.
      throw err;
    } else {
      // Do not retry on any other database error.
      return bail(new Verror({ name: 'DatabaseDriverError', cause: err, info: { dbName: this.name } }, `Failed to ${info.opName} on database ${this.name}`));
    }
  }

  /**
   * Executes a database operation with rettry on too_many_requests error.
   * @param {Function} op - Database operation to execute.
   * @param {Object} info - Info object for the operation. Currently only property name should exist.
   * @param {Function} onError - Function that is called in case of any error.
   * @returns {Promise<*>} - In case of an error the promise is resolved to Error object; in case of success result depends on actual operation bein executed.
   * @private
   */
  async execWithRetry(op, info, onError = this.defaultOnError.bind(this)) {
    // retry operation until retryOptions.retries is reached
    return asyncRetry(async bail => {
      try {
        return await op();
      } catch (err) {
        return onError(bail, err, info);
      }
    }, retryOptions);
  }

  // noinspection JSMethodCanBeStatic
  /**
   * Gets type of this driver.
   * @returns {string} - Type of this driver.
   */
  // eslint-disable-next-line class-methods-use-this
  get type() {
    return 'Cloudant Driver';
  }

  /**
   * Connect to the database that has been specified on instantiation in parameter 'name' using
   * the the connection also given in constructor call.
   * @returns {CloudantDb} - Connected driver instance
   * @throws {Verror} - Throws on connection error.
   */
  connect() {
    try {
      this.db = this.handle.use(this.name);
      this.connected = true;
      return this;
    } catch (err) {
      const verror = new Verror({
        name: 'Database Driver Error',
        cause: err,
        info: {
          dbName: this.name,
        },
      }, `Failed to connect to databse ${this.name}`);

      throw verror;
    }
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Returns true if a connection to the database has been established.
   * @returns {boolean} - True if connection has been established.
   */
  get isConnected() {
    return this.connected;
  }

  /**
   * Lookup document with <i>id</i> in database. Please note that this is a lookup operation.
   * It will return none or excatly one document or fail. For free Cloudant instances this is the
   * operation which allows the highest number of operations/second.
   * @param {String} id - id of the document
   * @returns {Promise<Object|Verror>} - Resolves to the document or an empty document when not found
   */
  async get(id) {
    const options = { revs_info: false };
    return this.execWithRetry(async () => this.db.get(id, options), { opName: 'get', key: id }, (bail, err, info) => {
      switch (err.statusCode) {
        case 404: return { };
        case 429: throw err;
        default: return bail(new Verror({ name: 'DatabaseDriverError', cause: err, info: { dbName: this.name } }, `Failed to ${info.opName}(${info.key}) on database ${this.name}`));
      }
    });
  }

  /**
   * Write some document to database
   * @param {Object} doc - The document to write to database. Depending on the presence of _rev
   * property this is an update attempt or an insert operation.
   * @returns {Promise<Object|Verror>} - Resolves to { body, header } object. One should not
   * make any assumptions on the content of these properties as they are db system specific.
   */
  async insertDocument(doc) {
    const newDoc = Object.assign({}, doc, { timestamp: new Date().toUTCString() });
    return this.execWithRetry(async () => this.db.insert(newDoc), { opName: 'insert' });
  }

  /**
   * Search in database using a Cloudant selector object.
   * @param {object} selector - Selector to use.
   * @returns {Promise<Object|Verror>}
   */
  async find(selector) {
    return this.execWithRetry(async () => this.db.find(selector), { opName: 'find' });
  }

  /**
   * Remove document from database
   * @param {Object} doc - Document that shall be deleted
   * @returns {Promise<*|Verror>}
   */
  async destroy(doc) {
    return this.execWithRetry(async () => this.db.destroy(doc._id, doc._rev), { opName: 'destroy' });
  }
}

module.exports = CloudantDb;
