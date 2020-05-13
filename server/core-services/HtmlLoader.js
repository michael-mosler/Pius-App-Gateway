const request = require('request');

/**
 * Extend Error class by additional property statusCode.
 * @extends {Error}
 * @property {Number} statusCode - HTML status code.
 */
class RequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Load data from a given URL.
 */
class HtmlLoader {
  /**
   * Instantiate a new HtmlLoader instance.
   * @param {String} fromUrl ULR to load from.
   */
  constructor(fromUrl) {
    this.fromUrl = fromUrl;
    this.request = request;
  }

  /**
   * Load data from ULR set in constructor and resolve promise with HTML document
   * in case of success. In case of error rejects promise with HTTP status
   * code.
   * @returns {Promise<String|RequestError>} - Web page as string or request error information object.
   */
  load() {
    return new Promise((resolve, reject) => {
      try {
        this.request({ method: 'get', url: this.fromUrl }, (error, response, data) => {
          if (error) {
            reject(new RequestError(`Failed to load data from URL ${this.fromUrl}: ${error}`, 503));
          } else if (response.statusCode === 200) {
            resolve(data);
          } else {
            reject(new RequestError(`Loading data from URL ${this.fromURL} returned HTTP status other than 200`, response.statusCode));
          }
        });
      } catch (err) {
        reject(new RequestError(err, 503));
      }
    });
  }
}

module.exports = { HtmlLoader, RequestError };
