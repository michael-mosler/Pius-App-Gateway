const Slack = require('slack');
const LogService = require('../helper/LogService');
const Config = require('./Config');

let instance;

/**
 * SlackBot provides post() method to send messagr to app-gateway channel
 * on slack.
 */
class SlackBot {
  constructor() {
    if (!instance) {
      this.logService = new LogService();
      this.token = Config.upsMap.get('slack').token;
      this.bot = new Slack();
      instance = this;
    }

    return this;
  }

  /**
   * Post a message to Slack channel app-gateway.
   * @param {String} message - Message to be posted, supports mark down.
   * @returns {Promise<*>} The promise will always be resolved with no data.
   */
  async post(message) {
    try {
      if (process.env.SLACK_ENABLED === 'true') {
        await this.bot.chat.postMessage({
          token: this.token,
          channel: 'app-gateway',
          text: message,
        });
      }
    } catch (err) {
      this.logService.logger.error(`Posting to slack has failed: ${err}`);
    }
  }
}

module.exports = SlackBot;
