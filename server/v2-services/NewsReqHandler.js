const NodeRestClient = require('node-rest-client').Client;
const Cheerio = require('cheerio');
const md5 = require('md5');
const Config = require('../Config');

class NewsItem {
  constructor(img, href, heading, text) {
    this.img = img;
    this.href = href;
    this.heading = heading;
    this.text = text;
  }
}

class NewsReqHandler {
  /**
   * Load Pius Gymnasium Homepage and resolve promise with HTML document
   * in case of success. In case of error rejects promise with HTTP status
   * code.
   * @returns {Promise}
   * @static
   * @private
   */
  static loadHomePage() {
    return new Promise((resolve, reject) => {
      const restClient = new NodeRestClient();
      const config = new Config();
      restClient.get(config.piusBaseUrl, (data, response) => {
        if (response.statusCode === 200) {
          resolve(data);
        } else {
          reject(response.statusCode);
        }
      });
    });
  }

  /**
   * Extracts news section from Pius home page.
   * @param {Object} data - Web page content
   * @returns {String} HTML page with header removed
   * @static
   * @private
   */
  static async getNewsFromHomePage(req, res) {
    try {
      const data = await NewsReqHandler.loadHomePage();
      const $ = Cheerio.load(data.toString());

      // Iterate on all Uber Grid cells
      const newsItems = [];
      $('.uber-grid-cell').each(function () {
        const config = new Config();
        NewsReqHandler.rewriteRefs($, config);

        const img = $('img', $(this));
        const a = $('a', $(this));
        let text = $('.uber-grid-hover-text', $(this)).text();
        const heading = $('.uber-grid-label-heading', $(this)).text();

        if (text.length > 159) {
          let i = 159;

          // Backward search next non-alphanum character.
          let h;
          for (h = i; h >= 0; h--) {
            if (text[h].match(/\W/)) {
              break;
            }
          }

          // Forward search next non-alphanum character.
          let j;
          for (j = i; j < text.length; j++) {
            if (text[j].match(/\W/)) {
              break;
            }
          }

          // Set split to nearest non-alphanum position.
          text = (i - h < j - i) ? text.substr(0, h) : text.substr(0, j);
        }

        const newsItem = new NewsItem(img.attr('src'), a.attr('href'), heading, text + ' ...');
        newsItems.push(newsItem);
      });

      const digest = md5(JSON.stringify(newsItems));
      if (process.env.DIGEST_CHECK === 'true' && digest === req.query.digest) {
        res.status(304).end();
      } else {
        res.status(200).send({ newsItems, _digest: digest });
      }
    } catch (statusCode) {
      res.status(statusCode).end();
    }
  }

  /**
   * Converts page into Cheerio DOM tree and rewrites all hrefs.
   * @param {Object} data - Page to convert
   * @returns {String} HTML page with header removed
   * @static
   */
  static pager(data) {
    const config = new Config();
    const $ = Cheerio.load(data);

    NewsReqHandler.rewriteRefs($, config);
    return $.html();
  }

  /**
   * Rewrites all href and src attributes to refer to Pius-Gateway service. Rewrite happens
   * in place.
   * @param {Object} $ - Cheerio DOM tree handle
   * @param {Config} config - App's config class instance
   * @private
   * @static
   */
  static rewriteRefs($, config) {
    $('script').each(function () {
      let uri = $(this).attr('src');
      if (uri) {
        uri = uri.replace(/^https?:\/\/pius-gymnasium.de\/?/, config.baseUrl);
        $(this).attr('src', uri);
      }
    });

    $('img').each(function () {
      let uri = $(this).attr('src');
      if (uri) {
        uri = uri.replace(/^https?:\/\/pius-gymnasium.de\/?/, config.baseUrl);
        $(this).attr('src', uri);
      }
    });

    $('link').each(function () {
      let uri = $(this).attr('href');
      if (uri) {
        uri = uri.replace(/^https?:\/\/pius-gymnasium.de\/?/, config.baseUrl);
        $(this).attr('href', uri);
      }
    });

    $('a').each(function () {
      let uri = $(this).attr('href');
      if (uri) {
        uri = uri.replace(/^https?:\/\/pius-gymnasium.de\/?/, config.baseUrl);
        $(this).attr('href', uri);
      }
    });
  }

  /**
   * Removes Pius News page's standard header.
   * @param {Object} data - Data as read from Pius web page.
   * @returns {String} HTML page with header removed
   */
  static removeStandardHeader(data) {
    const config = new Config();
    const $ = Cheerio.load(data);

    $('.left').remove();
    $('.right').remove();
    $('body > header:nth-child(2)').remove();
    $('#box').remove();

    $('script').each(function () {
      let uri = $(this).attr('src');
      if (uri) {
        uri = uri.replace(/^https?:\/\/pius-gymnasium.de\/?/, config.baseUrl);
        $(this).attr('src', uri);
      }
    });

    /*
    $('img').each(function () {
      let uri = $(this).attr('src');
      if (uri) {
        uri = uri.replace(/^https?:\/\/pius-gymnasium.de\/?/, config.baseUrl);
        $(this).attr('src', uri);
      }
    });
    */

    $('link').each(function () {
      let uri = $(this).attr('href');
      if (uri) {
        uri = uri.replace(/^https?:\/\/pius-gymnasium.de\/?/, config.baseUrl);
        $(this).attr('href', uri);
      }
    });

    return $.html();
  }
}

module.exports = NewsReqHandler;
