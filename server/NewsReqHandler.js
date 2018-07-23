const NodeRestClient = require('node-rest-client').Client;
const Cheerio = require('cheerio');
const Config = require('./Config');

class NewsReqHandler {
    /**
     *
     * @param data
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
        this.rewriteRefs($, config);

        $('#entry-right').attr('id', null);
        return $.html();
    }

    /**
     *
     * @param data
     * @returns {*|void}
     */
    static pager(data) {
        const config = new Config();
        const $ = Cheerio.load(data);

        this.rewriteRefs($, config);
        return $.html();
    }

    /**
     *
     * @param $
     * @param config
     * @private
     */
    static rewriteRefs($, config) {
        $('script').each(function () {
            let uri = $(this).attr('src');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, config.baseUrl);
                $(this).attr('src', uri);
            }
        });

        $('img').each(function () {
            let uri = $(this).attr('src');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, config.baseUrl);
                $(this).attr('src', uri);
            }
        });

        $('link').each(function () {
            let uri = $(this).attr('href');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, config.baseUrl);
                $(this).attr('href', uri);
            }
        });

        $('a').each(function () {
            let uri = $(this).attr('href');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, config.baseUrl);
                $(this).attr('href', uri);
            }
        });
    }

    /**
     *
     * @param data
     * @returns {*|void}
     */
    static removeStandardHeader(data) {
        const config = new Config();
        const $ = Cheerio.load(data);

        $('.left').remove();
        $('.right').remove();
        $('body > header:nth-child(2)').remove();
        $('#box').remove();

        $('script').each(function() {
            let uri = $(this).attr('src');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, config.baseUrl);
                $(this).attr('src', uri);
            }
        });

        $('img').each(function() {
            let uri = $(this).attr('src');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, config.baseUrl);
                $(this).attr('src', uri);
            }
        });

        $('link').each(function() {
            let uri = $(this).attr('href');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, config.baseUrl);
                $(this).attr('href', uri);
            }
        });

        return $.html();
    }
}

module.exports = NewsReqHandler;
