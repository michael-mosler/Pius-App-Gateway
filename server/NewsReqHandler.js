const NodeRestClient = require('node-rest-client').Client;
const Cheerio = require('cheerio');

class NewsReqHandler {
    /**
     *
     * @param data
     * @static
     * @private
     */
    static getNewsFromHomePage(data) {
        const $ = Cheerio.load(data);

        // Extract the News section from home page.
        const news = $('#entry-right');

        $('body').children().replaceWith(news);
        $('script').each(function(i, elem) {
            let uri = $(this).attr('src');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, 'https://pius-gateway.eu-de.mybluemix.net/');
                $(this).attr('src', uri);
            }
        });

        $('img').each(function(i, elem) {
            let uri = $(this).attr('src');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, 'https://pius-gateway.eu-de.mybluemix.net/');
                $(this).attr('src', uri);
            }
        });

        $('link').each(function(i, elem) {
            let uri = $(this).attr('href');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, 'https://pius-gateway.eu-de.mybluemix.net/');
                $(this).attr('href', uri);
            }
        });

        $('#entry-right').attr('id', null);
        return $.html();
    }
}

module.exports = NewsReqHandler;
