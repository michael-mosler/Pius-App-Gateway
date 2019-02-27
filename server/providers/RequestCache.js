const _ = require('underscore');
const memoryCache = require('memory-cache');

let instance;

class RequestCache {
  constructor(ttl) {
    if (!instance) {
      this.ttl = (isNaN(ttl)) ? 900000 : ttl * 60 * 1000;
      this.cache = new memoryCache.Cache();
      instance = this;
    }
    return instance;
  }

  /**
   * Caches requests on a URL.
   * @param {IncomingMessage} req - Incoming request object
   * @param {ServerResponse} res - Server response object
   * @param {Function} next - Pass on to next middleware
   */
  cacheFunction_(req, res, next) {
    try {
      let key = '__express__' + req.path;
      let cacheContent = this.cache.get(key);

      // When element is in cache return it immediately.
      if (cacheContent) {
        const { digest: requestDigest } = req.query;
        const result = _.filter(cacheContent, (obj) => _.some(obj, { _digest: requestDigest }));

        if (process.env.DIGEST_CHECK === 'true' && result.length > 0) {
          res.status(304).end();
        } else {
          res.send(cacheContent);
        }
      } else {
        console.log(`Key ${key} not in cache or outdated, will refetch.`);

        // Intercept res.send(): Put new data into cache before data is send.
        try {
          res.send_ = res.send;
          res.send = (body) => {
            this.cache.put(key, body, this.ttl);
            res.send_(body);
          };

          next();
        } catch (err) {
          // Restore original send method on error. Then
          // re-throw the error.
          res.send = res.send_;
          throw err;
        }
      }
    } catch (err) {
      console.log(`Processing cached request failed: ${err}`);
      this.cache.clear();
      res.status(503).end();
    }
  }

  get cachedRequest() {
    return this.cacheFunction_.bind(this);
  }
}

module.exports = RequestCache;
