const util = require('util');
const Helmet = require('helmet');
const nocache = require('nocache');
const Compression = require('compression');
const BodyParser = require('body-parser');
const CookieParser = require('cookie-parser');
const Express = require('express');
const Proxy = require('express-http-proxy');
const Cron = require('cron');
const url = require('url');
const sha1 = require('sha1');
const ExpressUseragent = require('express-useragent');

const LogService = require('./helper/LogService');
const Config = require('./core-services/Config');
const PostingsHandler = require('./v2-services/PostingsHandler');
const NewsReqHandler = require('./v1-services/NewsReqHandler');
const NewsReqHandlerV2 = require('./v2-services/NewsReqHandler');
const VertretungsplanHandler = require('./v1-services/VertretungsplanHandler');
const EvaRequestHandler = require('./v2-services/EvaRequestHandler');
const CalendarHandler = require('./v1-services/CalendarHandler');
const EvaService = require('./functional-services/EvaService');
const SlackBot = require('./core-services/SlackBot');
const DeviceTokenManager = require('./core-services/DeviceTokenManager');
const RequestCache = require('./providers/RequestCache');
const { StaffLoaderJob } = require('./functional-services/StaffLoaderJob');
const StaffHandler = require('./v2-services/StaffHandler');

const slackBot = new SlackBot();

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
    this.logService = new LogService();
    this.config = new Config();
    this.pusherJobs = [];
    this.staffLoaderJob = null;
    this.requestCache = null;

    this.initApp();
    this.expressApp = this.initMiddleware();

    this.evaService = new EvaService();
    this.deviceTokenManager = new DeviceTokenManager();
    this.deviceTokenManagerV2 = new DeviceTokenManager('v2');
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
    process.on('uncaughtException', async (err) => {
      this.logService.logger.error(`Unhandled exception: ${err.stack}`);
      await slackBot.post(`Pius-Gateway crashed with an unhandled exception: ${err.stack}`);
      process.exit(-1);
    });
    process.on('unhandledRejection', async (reason) => {
      this.logService.logger.error(`Unhandled promise rejection: ${reason.stack}`);
      await slackBot.post(`Pius-Gateway crashed with an unhandled promise rejection: ${reason.stack || reason}`);
      process.exit(-1);
    });

    this.requestCache = new RequestCache(process.env.TTL);

    // Initialise pusher.
    this.createPusherJobs();

    if (process.env.START_PUSHER === 'true') {
      this.pusherJobs.forEach(job => job.start());
      this.logService.logger.info('Pusher jobs have been started');
      slackBot.post('Pushers have been started.');
    }

    this.createStaffLoaderJob();
    if (process.env.START_STAFF_LOADER === 'true') {
      this.staffLoaderJob.start();
      this.logService.logger.info('Staff loader job has been started');
      slackBot.post('Staff Loader job has been started.');
    }
  }

  /**
   * Create the pusher job.
   * @private
   */
  createPusherJobs() {
    this.logService.logger.info('Creating pusher jobs...');

    // From 9am to 6:55am we check every 5 minutes. From 7am to 8:59am we check
    // every minute.
    this.pusherJobs.push(
      new Cron.CronJob('0 */5 0-6,9-23 * * *', () => {
        const vertretungsplanHandler = new VertretungsplanHandler('v2');
        vertretungsplanHandler.checker();
      }, null, false, 'Europe/Berlin'),
      new Cron.CronJob('0 * 7-8 * * *', () => {
        const vertretungsplanHandler = new VertretungsplanHandler('v2');
        vertretungsplanHandler.checker();
      }, null, false, 'Europe/Berlin'),
    );
  }

  /**
   * Creates the staff load job. Job runs every nivht a 3am CE(S)T.
   * @private
   */
  createStaffLoaderJob() {
    this.logService.logger.info('Creating staff loader job...');

    this.staffLoaderJob = new Cron.CronJob('0 0 3 * * *', async () => {
      const logService = new LogService();
      try {
        logService.logger.info('Running staff loader job');
        const staffLoaderJob = new StaffLoaderJob();
        await staffLoaderJob.run();
        logService.logger.info('Staff loader job finished successfully');
      } catch (err) {
        logService.logger.error(`Staff Loader Job failed: ${err}`);
      }
    }, null, false, 'Europe/Berlin');
  }

  /**
   * Initialises the Express middleware.
   * @returns {Express}
   * @private
   */
  initMiddleware() {
    const expressApp = Express();
    expressApp.use(ExpressUseragent.express());

    if (process.env.DIGEST_CHECK === 'true') {
      slackBot.post('Digest check is enabled.');
    }

    if (process.env.COMPRESSION === 'true') {
      this.logService.logger.info('Enabling compression');
      slackBot.post('Compression is enabled.');
      expressApp.use(Compression());
    }

    expressApp.use(Helmet());
    expressApp.use(nocache());

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
   * @static
   * @private
   */
  static catchify(f) {
    return async (req, res) => {
      try {
        await f(req, res);
      } catch (err) {
        const logService = new LogService();
        logService.logger.error(`Function ${f} failed: ${err.stack}`);
        res.status(500).end();
      }
    };
  }

  /**
   * Check if request has correct API token and if so call f(req, res).
   * f will get catchified before being called, thus no exception or unhandled
   * promise rejection will break the caller.
   * @param {Request} req Express request object
   * @param {ServerResponse} res Express response object
   * @param {Function} f Function to run; (req, res) => { ... }
   */
  authorizedExec(req, res, f) {
    if (sha1(req.body.apiKey) !== Config.apiKey) {
      res.status(401).end();
    } else {
      App.catchify(f)(req, res);
    }
  }

  /**
   * Initialise Express routing.
   * @returns {Router}
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

    router.get('/v2/staff', App.catchify((req, res) => {
      const staffHandler = new StaffHandler();
      staffHandler.process(req, res);
    }));

    router.head('/validateLogin', App.catchify((req, res) => {
      const vertretungsplanHandler = new VertretungsplanHandler();
      vertretungsplanHandler.validateLogin(req, res);
    }));

    // Device Token Manager routes.
    router.post('/deviceToken', App.catchify((req, res) => this.deviceTokenManager.registerDeviceToken(req, res)));
    router.post('/v2/deviceToken', App.catchify((req, res) => this.deviceTokenManagerV2.registerDeviceToken(req, res)));

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

    router.post('/pusher', (req, res) => {
      this.authorizedExec(req, res, (req, res) => {
        this.logService.logger.info('Starting pushers...');
        this.pusherJobs.forEach(job => job.start());
        res.status(200).end();
      });
    });

    router.delete('/pusher', (req, res) => {
      this.authorizedExec(req, res, (req, res) => {
        this.logService.logger.info('Stopping pushers..');
        this.pusherJobs.forEach(job => job.stop());
        res.status(200).end();
      });
    });

    router.post('/staffLoader', (req, res) => {
      this.authorizedExec(req, res, (req, res) => {
        this.logService.logger.info('Starting Staff Loader...');
        this.staffLoaderJob.start();
        res.status(200).end();
      });
    });

    router.delete('/staffLoader', (req, res) => {
      this.authorizedExec(req, res, (req, res) => {
        this.logService.logger.info('Stopping Staff Loader..');
        this.staffLoaderJob.stop();
        res.status(200).end();
      });
    });

    // DEBUG routes are available in dev only.
    if (process.env.NODE_ENV === 'dev') {
      // Trigger push notification.
      router.put('/pusher', (req, res) => {
        this.logService.logger.info('POST on /checker');
        const vertretungsplanHandler = new VertretungsplanHandler('v2');
        vertretungsplanHandler.checker();

        res.status(200).end();
      });

      router.put('/staffLoader', async (req, res) => {
        try {
          this.logService.logger.info('POST on /staffLoader');
          const staffLoaderJob = new StaffLoaderJob();
          await staffLoaderJob.run();
          res.status(200).end();
        } catch (err) {
          res.status(500).send(err);
        }
      });

      router.put('/debug', (req, res) => {
        try {
          this.logService.logger.debug(`PUT on /debug, setting options date to ${util.inspect(req.body)}`);
          const config = new Config();
          config.simDate = req.body.simDate;
          config.debugSchedulesDbDocId = req.body.debugSchedulesDbDocId;
          res.status(200).end();
        } catch (err) {
          this.logService.logger.error(`Failed to set debug options: ${err}`);
          res.status(400).end();
        }
      });

      router.delete('/debug', (req, res) => {
        this.logService.logger.debug('DELETE on /debug');
        const config = new Config();
        config.simDate = null;
        config.debugSchedulesDbDocId = undefined;
        res.status(200).end();
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
      this.logService.logger.info(`Application is listening at: ${this.config.port}`);
    } catch (err) {
      this.logService.logger.error(`The middleware failed to start with error ${err}\n`);
      process.exit(-1);
    }
  }
}

(async () => {
  await slackBot.post('Pius-Gateway is being (re)started.');
  const app = new App();
  app.run();
  slackBot.post('*Pius-Gateway is ready.*');
})();
