const BodyParser = require('body-parser');
const CookieParser = require('cookie-parser');
const Express = require('express');
const Proxy = require('express-http-proxy');

const Config = require('./Config');
const NewsReqHandler = require('./NewsReqHandler');
const VertretungsplanHandler = require('./VertretungsplanHandler');

class App {
    constructor() {
        this.config = new Config();
        this.port = process.env.PORT || this.config.port;
        this.expressApp = App.initMiddleware();
        this.initRouting();
        this.vertretungsplanHandler = new VertretungsplanHandler();
    }

    /**
     * @returns {Express}
     * @static
     * @private
     */
    static initMiddleware() {
        const expressApp = Express();

        // parse application/x-www-form-urlencoded
        expressApp.use(BodyParser.urlencoded({extended: true}));

        // parse application/json
        expressApp.use(BodyParser.json());

        // parse cookies
        expressApp.use(CookieParser());

        // remove redundant headers
        expressApp.disable('x-powered-by');

        return expressApp;
    }

    /**
     * @private
     */
    initRouting() {
        const newsReqHandler = new NewsReqHandler();

        this.expressApp.use(/^\/news$/, Proxy(this.config.piusBaseUrl, {
            userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
                return NewsReqHandler.getNewsFromHomePage(proxyResData);
            },
        }));

        this.expressApp.use(/^\/vertretungsplan/, (req, res) => {
            this.vertretungsplanHandler.process(req, res);
        });

        this.expressApp.use(/.*/, Proxy(this.config.piusBaseUrl, {
            proxyReqPathResolver: function(req) {
                return require('url').parse(req.originalUrl).path;
            }
        }));
    }

    /**
     *
     */
    run() {
        try {
            this.expressApp.listen(this.port);
            process.stdout.write(`Application is listening at: ${this.port}\n`);
        } catch (err) {
            process.stderr.write(`The middleware failed to start with error ${err}\n`);
            process.exit(-1);
        }
    }
}

const app = new App();
app.run();