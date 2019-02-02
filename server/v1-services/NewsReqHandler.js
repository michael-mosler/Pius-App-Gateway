const Cheerio = require('cheerio');
const Config = require('../core-services/Config');

class NewsReqHandler {
  /**
   * Extracts news section from Pius home page.
   * @param {Object} data - Web page content
   * @returns {String} HTML page with header removed
   * @static
   * @private
   */
  static getNewsFromHomePage(data) {
    const config = new Config();
    const $ = Cheerio.load(data);

    // Extract the News section from home page.
    const news = $('#entry-right');

    $('body').children().replaceWith(news);

    // Remove News h2-header element.
    $('.entry > h2:nth-child(1)').remove();
    NewsReqHandler.rewriteRefs($, config);

    $('#entry-right').attr('id', null);
    return $.html();
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
    /*
    $('#box').remove();
    */

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

    return $.html();
  }
}

module.exports = NewsReqHandler;
