const memoryCache = require('memory-cache');

let instance;

/**
 * Caches Express response result. Put cachedRequest before your standard request handler.
 * Standard request handler needs to check if res.isCachedRequest is true. In this case
 * status code 304 must be send with body data. After putting body data into cache
 * 304 is sent to client.
 */
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

        if (process.env.DIGEST_CHECK === 'true' && cacheContent._digest === requestDigest) {
          res.status(304).end();
        } else {
          res.status(200).send(cacheContent);
        }
      } else {
        console.log(`Key ${key} not in cache or outdated, will refetch.`);

        // Intercept res.send(): Put new data into cache before data is send.
        res.send_ = res.send;
        res.isCachedRequest = true;

        res.send = (body) => {
          try {
            if (typeof body === 'string') {
              // If res.send() has transformed JSON to string parse it back to JSON.
              this.cache.put(key, JSON.parse(body), this.ttl);
            } else {
              this.cache.put(key, body, this.ttl);
            }

            const { statusCode = 500 } = res;
            if (statusCode === 304) {
              res.status(304).end();
            } else if (body) {
              res.status(statusCode).send_(body);
            } else {
              res.status(statusCode).end();
            }
          } catch (err) {
            console.log(`res.send() for cached request failed: ${err.stack}`);
            res.status(500).end();
          };
        };

        next();
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
