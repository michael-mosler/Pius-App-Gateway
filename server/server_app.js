const Helmet = require('helmet');
const Compression = require('compression');
const BodyParser = require('body-parser');
const CookieParser = require('cookie-parser');
const Express = require('express');
const Proxy = require('express-http-proxy');
const Cron = require('cron');

const Config = require('./Config');
const NewsReqHandler = require('./NewsReqHandler');
const NewsReqHandlerV2 = require('./v2-services/NewsReqHandler');
const VertretungsplanHandler = require('./VertretungsplanHandler');
const CalendarHandler = require('./CalendarHandler');
const Pusher = require('./Pusher');

const DeviceTokenManager = require('./DeviceTokenManager');

/**
 * This class implements our middleware. It create an Express middleware and registers
 * all routes within an Express router. It also sets up a cron job that regularly
 * checks substitution schedule for changes. Finally it puts itself into listen
 * and waits for incoming requests.
 * When changes to substitution schedule are detected push notifications are sent
 * to all registered devices subscribed to to the grade where a change occured.
 */
class App {
  constructor() {
    this.config = new Config();
    this.pusherJob = null;

    this.initApp();
    this.expressApp = App.initMiddleware();

    this.deviceTokenManager = new DeviceTokenManager();
    this.router = this.initRouting();
    this.expressApp.use('/', this.router);
  }

  /**
   * Basic App initialisation.
   * @private
   */
  initApp() {
    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
    process.on('uncaughtException', (err) => {
      console.log(`Unhandled exception exception: ${err}\n`);
      process.exit(-1);
    });

    // Initialise pusher.
    this.pusher = new Pusher();
    this.createPusherJob();

    if (process.env.START_PUSHER === 'true') {
      this.pusherJob.start();
    }
  }

  /**
   * Create the pusher job.
   */
  createPusherJob() {
    console.log('Creating pusher job...');
    this.pusherJob = new Cron.CronJob('0 0,5,10,15,20,25,30,35,40,45,50,55 * * * *', () => { // eslint-disable-line no-unused-vars
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.checker();
    }, null, false, 'Europe/Berlin');
  }

  /**
   * Initialises the Express middleware.
   * @returns {Express}
   * @static
   * @private
   */
  static initMiddleware() {
    const expressApp = Express();

    if (process.env.COMPRESSION === 'true') {
      console.log('Enabling compression');
      expressApp.use(Compression());
    }
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

    router.get(/^\/v2\/news$/, (req, res) => {
      NewsReqHandlerV2.getNewsFromHomePage(req, res);
    });

    router.get('/vertretungsplan', (req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.process(req, res);
    });

    router.get('/v2/vertretungsplan', (req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler('v2');
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
        if (userReq.originalUrl.match(/wordpress\/wp-admin\/admin-ajax.php/)) {
          return NewsReqHandler.pager(proxyResData);
        }

        return (userReq.originalUrl.match(/.html?$/))
          ? NewsReqHandler.removeStandardHeader(proxyResData)
          : proxyResData;
      },
    }));

    router.post('/startPusher', (req, res) => {
      if (req.body.apiKey !== Config.apiKey) {
        res.status(401).end();
      } else if (this.pusherJob) {
        this.pusherJob.start();
        console.log('Starting pusher...');
        res.status(200).end();
      } else {
        res.status(404).end();
      }
    });

    router.delete('/startPusher', (req, res) => {
      if (req.body.apiKey !== Config.apiKey) {
        res.status(401).end();
      } else if (this.pusherJob) {
        console.log('Stopping pusher...');
        this.pusherJob.stop();
        res.status(200).end();
      } else {
        res.status(404).end();
      }
    });

    // DEBUG routes are available in dev only.
    if (process.env.NODE_ENV === 'dev') {
      // Trigger push notification.
      router.post('/checker', (req, res) => {
        console.log('POST on /checker');
        const vertretungsplanHandler = new VertretungsplanHandler();
        vertretungsplanHandler.checker();

        res
          .status(200)
          .end();
      });
    }

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
      console.log(`The middleware failed to start with error ${err}\n`);
      process.exit(-1);
    }
  }
}

const app = new App();
app.run();
