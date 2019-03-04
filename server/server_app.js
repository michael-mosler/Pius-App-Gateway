const Helmet = require('helmet');
const Compression = require('compression');
const BodyParser = require('body-parser');
const CookieParser = require('cookie-parser');
const Express = require('express');
const Proxy = require('express-http-proxy');
const Cron = require('cron');
const url = require('url');

const Config = require('./core-services/Config');
const PostingsHandler = require('./v2-services/PostingsHandler');
const NewsReqHandler = require('./v1-services/NewsReqHandler');
const NewsReqHandlerV2 = require('./v2-services/NewsReqHandler');
const VertretungsplanHandler = require('./v1-services/VertretungsplanHandler');
const EvaRequestHandler = require('./v2-services/EvaRequestHandler');
const CalendarHandler = require('./v1-services/CalendarHandler');
const Pusher = require('./functional-services/Pusher');
const EvaService = require('./functional-services/EvaService');
const SlackBot = require('./core-services/SlackBot');
const DeviceTokenManager = require('./core-services/DeviceTokenManager');
const RequestCache = require('./providers/RequestCache');

const bot = new SlackBot();

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
    this.pusher = null;
    this.pusherJob = null;
    this.requestCache = new RequestCache(process.env.TTL);

    this.initApp();
    this.expressApp = this.initMiddleware();

    this.evaService = new EvaService();
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
      console.log(`Unhandled exception: ${err.stack}`);
      bot.post(`Pius-Gateway crashed with an unhandled exception: ${err.stack}`);
      process.exit(-1);
    });
    process.on('unhandledRejection', (reason) => {
      console.log(`Unhandled promise rejection: ${reason.stack}`);
      bot.post(`Pius-Gateway crashed with an unhandled promise rejection: ${reason}`);
      process.exit(-1);
    });

    // Initialise pusher.
    this.pusher = new Pusher();
    this.createPusherJob();

    if (process.env.START_PUSHER === 'true') {
      this.pusherJob.start();
      bot.post('Pusher has been started.');
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
  initMiddleware() {
    const expressApp = Express();

    if (process.env.DIGEST_CHECK === 'true') {
      bot.post('Digest check is enabled.');
    }

    if (process.env.COMPRESSION === 'true') {
      console.log('Enabling compression');
      bot.post('Compression is enabled.');
      expressApp.use(Compression());
    }

    expressApp.use(Helmet({ noCache: true }));

    // parse application/x-www-form-urlencoded
    expressApp.use(BodyParser.urlencoded({ extended: true }));

    // parse application/json
    expressApp.use(BodyParser.json());

    // parse cookies
    expressApp.use(CookieParser());

    return expressApp;
  }

  /**
   * Takes a function f that processes an incoming Express request and sends result on
   * res object and encapsulates it into a try-catch block. Catch will log error and
   * send HTTP status 503.
   * @param {Function} f A function that takes Express (req, res) as input, can be async.
   * @returns {Function} Catchified function.
   */
  static catchify(f) {
    return async (req, res) => {
      try {
        await f(req, res);
      } catch (err) {
        console.log(`Function ${f} failed: ${err.stack}`);
        res.status(500).end();
      }
    };
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

    router.get(/^\/v2\/news$/, this.requestCache.cachedRequest, App.catchify((req, res) => {
      const newsReqHandler = new NewsReqHandlerV2();
      newsReqHandler.getNewsFromHomePage(req, res);
    }));

    router.get('/v2/postings', App.catchify((req, res) => {
      const postingsHandler = new PostingsHandler();
      postingsHandler.process(req, res);
    }));

    router.get('/v2/vertretungsplan', App.catchify((req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler('v2');
      vertretungsplanHandler.process(req, res);
    }));

    router.get('/v2/eva', App.catchify((req, res) => {
      EvaRequestHandler.process(req, res);
    }));

    router.get('/vertretungsplan', App.catchify((req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.process(req, res);
    }));

    router.get('/calendar', this.requestCache.cachedRequest, App.catchify((req, res) => {
      const calendarHandler = new CalendarHandler();
      calendarHandler.process(req, res);
    }));

    router.get('/validateLogin', App.catchify((req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.validateLogin(req, res);
    }));

    // Device Token Manager routes.
    router.post('/deviceToken', App.catchify((req, res) => this.deviceTokenManager.registerDeviceToken(req, res)));

    // All other stuff is forwarded to Pius website.
    router.get(/.*/, Proxy(this.config.piusBaseUrl, {
      proxyReqPathResolver: function (req) {
        // eslint-disable-next-line node/no-deprecated-api
        return url.parse(req.originalUrl).path;
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

(async () => {
  await bot.post('Pius-Gateway is being (re)started.');
  const app = new App();
  app.run();
  bot.post('*Pius-Gateway is ready.*');
})();
