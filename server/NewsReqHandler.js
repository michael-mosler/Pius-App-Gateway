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

        // Remove News h2-header element.
        $('.entry > h2:nth-child(1)').remove();

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

        $('a').each(function(i, elem) {
            let uri = $(this).attr('href');
            if (uri) {
                uri = uri.replace(/^http:\/\/pius-gymnasium.de\/?/, 'https://pius-gateway.eu-de.mybluemix.net/');
                $(this).attr('href', uri);
            }
        });

        $('#entry-right').attr('id', null);
        return $.html();
    }

    static removeStandardHeader(data) {
        const $ = Cheerio.load(data);

        $('.left').remove();
        $('.right').remove();
        $('body > header:nth-child(2)').remove();

        return $.html();
    }
}

module.exports = NewsReqHandler;
