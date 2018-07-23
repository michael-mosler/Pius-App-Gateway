const BodyParser = require('body-parser');
const CookieParser = require('cookie-parser');
const Express = require('express');
const Proxy = require('express-http-proxy');

const Config = require('./Config');
const NewsReqHandler = require('./NewsReqHandler');
const VertretungsplanHandler = require('./VertretungsplanHandler');
const CalendarHandler = require('./CalendarHandler');

const DeviceTokenManager = require('./DeviceTokenManager');

class App {
  constructor() {
    this.config = new Config();
    this.expressApp = App.initMiddleware();
    this.router = Express.Router();

    this.deviceTokenManager = new DeviceTokenManager();
    this.initRouting();
  }

  /**
   * @returns {Express}
   * @static
   * @private
   */
  static initMiddleware() {
    const expressApp = Express();

    // parse application/x-www-form-urlencoded
    expressApp.use(BodyParser.urlencoded({ extended: true }));

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
    this.router.get(/^\/news$/, Proxy(this.config.piusBaseUrl, {
      userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
        return NewsReqHandler.getNewsFromHomePage(proxyResData);
      },
    }));

    this.router.get(/^\/vertretungsplan/, (req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.process(req, res);
    });

    this.router.get(/^\/calendar/, (req, res) => {
      const calendarHandler = new CalendarHandler();
      calendarHandler.process(req, res);
    });

    this.router.get(/^\/validateLogin/, (req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.validateLogin(req, res);
    });

    this.router.get(/.*/, Proxy(this.config.piusBaseUrl, {
      proxyReqPathResolver: function (req) {
        return require('url').parse(req.originalUrl).path;
      },
      userResDecorator: function (proxyRes, proxyResData, userReq) {
        if (userReq.baseUrl.match(/wordpress\/wp-admin\/admin-ajax.php/)) {
          return NewsReqHandler.pager(proxyResData);
        }

        return (userReq.baseUrl.match(/.html?$/))
          ? NewsReqHandler.removeStandardHeader(proxyResData)
          : proxyResData;
      },
    }));

    // Device Token Manager routes.
    this.router.post('/deviceToken', (req, res) => this.deviceTokenManager.addDeviceToken(req, res));
    this.router.put('/deviceToken', (req, res) => this.deviceTokenManager.updateDeviceToken(req, res));
  }

  /**
   *
   */
  run() {
    try {
      this.expressApp.listen(this.config.port);
      process.stdout.write(`Application is listening at: ${this.config.port}\n`);
    } catch (err) {
      process.stderr.write(`The middleware failed to start with error ${err}\n`);
      process.exit(-1);
    }
  }
}

const app = new App();
app.run();
