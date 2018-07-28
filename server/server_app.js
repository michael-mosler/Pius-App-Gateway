const Helmet = require('helmet');
const BodyParser = require('body-parser');
const CookieParser = require('cookie-parser');
const Express = require('express');
const Proxy = require('express-http-proxy');
const Cron = require('cron');

const Config = require('./Config');
const NewsReqHandler = require('./NewsReqHandler');
const VertretungsplanHandler = require('./VertretungsplanHandler');
const CalendarHandler = require('./CalendarHandler');

const DeviceTokenManager = require('./DeviceTokenManager');

class App {
  constructor() {
    this.config = new Config();

    App.initApp();
    this.expressApp = App.initMiddleware();

    this.deviceTokenManager = new DeviceTokenManager();
    this.router = this.initRouting();
    this.expressApp.use('/', this.router);
  }

  static initApp() {
    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));

    const cronjob = new Cron.CronJob('0 0,5,10,15,20,25,30,23,40,45,50,55 * * * *', () => console.log('Hi, that\'s your cron job'), true, 'Europe/Berlin'); // eslint-disable-line no-unused-vars
  }

  /**
   * Initialises the Express middleware.
   * @returns {Express}
   * @static
   * @private
   */
  static initMiddleware() {
    const expressApp = Express();
    expressApp.use(Helmet());

    // parse application/x-www-form-urlencoded
    expressApp.use(BodyParser.urlencoded({ extended: true }));

    // parse application/json
    expressApp.use(BodyParser.json());

    // parse cookies
    expressApp.use(CookieParser());

    return expressApp;
  }

  /**
   * Initialise Express routing.
   * @private
   */
  initRouting() {
    const router = Express.Router();

    router.use(/^\/news$/, Proxy(this.config.piusBaseUrl, {
      userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
        return NewsReqHandler.getNewsFromHomePage(proxyResData);
      },
    }));

    router.get('/vertretungsplan', (req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.process(req, res);
    });

    router.get('/calendar', (req, res) => {
      const calendarHandler = new CalendarHandler();
      calendarHandler.process(req, res);
    });

    router.get('/validateLogin', (req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.validateLogin(req, res);
    });

    // Device Token Manager routes.
    router.post('/deviceToken', (req, res) => this.deviceTokenManager.registerDeviceToken(req, res));

    // All other stuff is forwarded to Pius website.
    router.get(/.*/, Proxy(this.config.piusBaseUrl, {
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

    return router;
  }

  /**
   * Runs our middleware component by putting it into listen.
   */
  run() {
    try {
      this.expressApp.listen(this.config.port);
      console.log(`Application is listening at: ${this.config.port}`);
    } catch (err) {
      process.stderr.write(`The middleware failed to start with error ${err}\n`);
      process.exit(-1);
    }
  }
}

const app = new App();
app.run();
