/* eslint-disable max-len */
const Verror = require('verror');
const retry = require('retry');
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

      console.log(`${verror}\n`);
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
   * Creates a database on the current connection.
   * @param {String} name - Name of the database
   * @returns {Promise<CloudantDb|Verror>} - Resolves to <i>this</i> on success.
   * @private
   */
  createAnyDatabase(name) {
    return new Promise((resolve, reject) => {
      this.handle.db.create(name, (err) => {
        if (err) {
          const verror = new Verror({
            name: 'Database Driver Error',
            cause: err,
            info: {
              dbName: this.name,
            },
          }, `Failed to create database ${this.name}`);

          console.log(`${verror}\n`);
          reject(verror);
        } else {
          resolve(this);
        }
      });
    });
  }

  /**
   * Create database. Name is as set when database object is instantiated.
   * @returns {Promise<CloudantDb|Verror>} - Resolves to "this" on success.
   */
  create() {
    return this.createAnyDatabase(this.name);
  }

  /**
   * Drops database with the given name on the current connection.
   * @returns {Promise<CloudantDb|Verror>} - Resolves to "this" on success.
   */
  dropAnyDatabase(name) {
    return new Promise((resolve, reject) => {
      this.handle.db.destroy(name, (err) => {
        if (err) {
          const verror = new Verror({
            name: 'DatabaseDriverError',
            cause: err,
            info: {
              dbName: this.name,
            },
          }, `Failed to drop database ${this.name}`);

          console.log(`${verror}\n`);
          reject(verror);
        } else {
          this.connected = false;
          resolve(this);
        }
      });
    });
  }

  /**
   * Drop database. Name is as set when database object is instantiated.
   * @returns {Promise<CloudantDb|Verror>} - Resolves to "this" on success.
   */
  drop() {
    return this.dropAnyDatabase(this.name);
  }

  /**
   * Lookup document with <i>id</i> in database. Please note that this is a lookup operation.
   * It will return none or excatly one document or fail. For free Cloudant instances this is the
   * operation which allows the highest number of operations/second.
   * @param {String} id - id of the document
   * @returns {Promise<Object|Verror>} - Resolves to the document or an empty document when not found
   */
  get(id) {
    return new Promise((resolve, reject) => {
      // initialize retry object
      const operation = retry.operation(retryOptions);

      // retry operation until retryOptions.retries is reached
      operation.attempt(() => {
        const options = { revs_info: false };
        this.db.get(id, options, (err, body) => {
          if (!err) {
            resolve(body);
            return;
          }

          switch (err.error) {
            case 'too_many_requests': {
              if (operation.retry(err)) {
                return;
              }
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                  docName: id,
                },
              }, `Retry limit in exceeded when getting from database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }

            default: {
              if (err.error === 'not_found') {
                resolve({});
              } else {
                const verror = new Verror({
                  name: 'DatabaseDriverError',
                  cause: err,
                  info: {
                    dbName: this.name,
                    docName: id,
                  },
                }, `Failed to get from database ${this.name}`);

                console.log(`${verror}\n`);
                reject(verror);
                break;
              }
            }
          }
        });
      });
    });
  }

  /**
   * Get some data from this database - always resolves an Array
   * @param {string} designName - Name of the design that holds the view to query
   * @param {string} viewName - Name of the view to query
   * @param {Array|*} keys - An array of keys to filter on, pass as undefined if no filtering is needed
   * @param {boolean} [descending=false] - Return result in descending sort order
   * @param {boolean} [reduce=false} - Apply reduce function
   * @param {int|*} [groupLevel=undefined] - Only if reduce is true; group to the specified number of keys
   * @param {int} [skip=0] - Skip this number of rows from the beginning
   * @param {int} [limit=1] - Limit result to this number of rows
   * @returns {Promise<Object|Verror>} - Promise is resolved to selected documents
   */
  getDocument(designName, viewName, keys, {
    descending = false,
    reduce = false, groupLevel = undefined,
    skip = 0, limit = 1 } = {}) {
    return new Promise((resolve, reject) => {
      // initialize retry object
      const operation = retry.operation(retryOptions);

      // retry operation until retryOptions.retries is reached
      operation.attempt(() => {
        const options = {
          skip,
          limit,
          include_docs: false,
          descending,
          reduce,
          keys,
        };

        if (groupLevel) {
          options.group_level = groupLevel;
        }

        this.db.view(designName, viewName, options, (err, body) => {
          if (!err) {
            resolve(body.rows);
            return;
          }

          switch (err.error) {
            case 'not_found': {
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                  designName,
                  viewName,
                },
              }, `Design name ${designName} or view ${viewName} does not exist in database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }

            case 'too_many_requests': {
              if (operation.retry(err)) {
                return;
              }
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                  designName,
                  viewName,
                },
              }, `Retry limit in exceeded when reading from view in ${viewName} in design ${designName} and database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }

            default: {
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                  designName,
                  viewName,
                },
              }, `Failed to read from view ${viewName} in design ${designName} and database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }
          }
        });
      });
    });
  }

  /**
   * Write some document to database
   * @param {Object} doc - The document to write to database. Depending on the presence of _rev
   * property this is an update attempt or an insert operation.
   * @returns {Promise<Object|Verror>} - Resolves to { body, header } object. One should not
   * make any assumptions on the content of these properties as they are db system specific.
   */
  insertDocument(doc) {
    return new Promise((resolve, reject) => {
      // initialize retry object
      const operation = retry.operation(retryOptions);

      // retry operation until retryOptions.retries is reached
      operation.attempt(() => {
        const newDoc = Object.assign({}, doc, { timestamp: new Date().toUTCString() });

        this.db.insert(newDoc, (err, body) => {
          if (!err) {
            // eslint-disable-next-line no-underscore-dangle
            newDoc._id = body.id;
            // eslint-disable-next-line no-underscore-dangle
            newDoc._rev = body.rev;
            resolve(newDoc);
            return;
          }

          let verror = null;
          switch (err.error) {
            case 'too_many_requests': {
              if (operation.retry(err)) {
                return;
              }
              verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Retry limit in exceeded when inserting into database ${this.name}`);
              break;
            }
            case 'conflict': {
              verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Failed to insert into database ${this.name} because of document conflict`);
              break;
            }
            default: {
              verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Failed to insert into database ${this.name}`);
              break;
            }
          }
          console.log(`${verror}\n`);
          reject(verror);
        });
      });
    });
  }

  /**
   * Search in database using a Cloudant selector object.
   * @param {object} selector - Selector to use.
   * @returns {Promise<Object|Verror>}
   */
  find(selector) {
    return new Promise((resolve, reject) => {
      const operation = retry.operation(retryOptions);

      // retry operation until retryOptions.retries is reached
      operation.attempt(() => {
        this.db.find(selector, (err, result) => {
          if (!err) {
            resolve(result);
            return;
          }

          switch (err.error) {
            case 'too_many_requests': {
              if (operation.retry(err)) {
                return;
              }
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Retry limit exceeded when finding on database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }
            default: {
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Failed to find on database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }
          }
        });
      });
    });
  }

  /**
   * Remove document from database
   * @param {Object} doc - Document that shall be deleted
   * @returns {Promise<*|Verror>}
   */
  destroy(doc) {
    return new Promise((resolve, reject) => {
      // initialize retry object
      const operation = retry.operation(retryOptions);

      // retry operation until retryOptions.retries is reached
      operation.attempt(() => {
        this.db.destroy(doc._id, doc._rev, (err, body) => { // eslint-disable-line
          if (!err) {
            resolve({ body });
            return;
          }

          switch (err.error) {
            case 'too_many_requests': {
              if (operation.retry(err)) {
                return;
              }

              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Retry limit exceeded when deleting document from databse ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }

            default: {
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Failed to delete document from database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }
          }
        });
      });
    });
  }

  /**
   * Bulk insert the given document. docs is an object with a single property named docs.
   * docs itself must be an array of the documents that are to be inserted, updated or deleted.
   * @param {object} docs - Document that implements the CloudantDB bulk operation data structure.
   * @param {object} options - Options to be passed to Cloudant's bulk operation.
   * @returns {Promise<*|Verror>}
   */
  bulk(docs, options) {
    return new Promise((resolve, reject) => {
      // initialize retry object
      const operation = retry.operation(retryOptions);

      // retry operation until retryOptions.retries is reached
      operation.attempt(() => {
        this.db.bulk(docs, options, (err, body) => { // eslint-disable-line
          if (!err) {
            resolve({ body });
            return;
          }

          switch (err.error) {
            case 'too_many_requests': {
              if (operation.retry(err)) {
                return;
              }

              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Retry limit exceeded when bulk inserting documents into database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }

            default: {
              const verror = new Verror({
                name: 'DatabaseDriverError',
                cause: err,
                info: {
                  dbName: this.name,
                },
              }, `Failed to bulk insert documents into database ${this.name}`);

              console.log(`${verror}\n`);
              reject(verror);
              break;
            }
          }
        });
      });
    });
  }

  /**
   * Configures the given replication document template with current values from middleware
   * configuration.
   * @param {object} replicationDocTemplate - The replication document template to configure
   * @param {String} source - Name of replication source
   * @param {String} target - Name of replication target
   * @returns {object} - Readily configured replication document.
   * @private
   */
  configureReplicationDocumentTemplate(replicationDocTemplate, source, target) {
    const newReplicationDoc = replicationDocTemplate;
    newReplicationDoc.source = newReplicationDoc.source
      .replace(/\${sourceURL}/, this.connection.dbURL)
      .replace(/\${sourceDbName}/, source);

    newReplicationDoc.target = newReplicationDoc.target
      .replace(/\${targetURL}/, this.connection.dbURL)
      .replace(/\${targetDbName}/, target);

    return newReplicationDoc;
  }
}

module.exports = CloudantDb;
