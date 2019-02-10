const util = require('util');
const apn = require('apn');
const Config = require('../core-services/Config');
const PushEventEmitter = require('./PushEventEmitter');
const DeviceTokenManager = require('../core-services/DeviceTokenManager');
const VertretungsplanHelper = require('../helper/VertretungsplanHelper');

/**
 * This class on instantiation registers on 'push' event. When such an event is received
 * a push notification is sent to all devices that match the events grade property.
 */
class Pusher {
  constructor() {
    this.deviceTokenManager = new DeviceTokenManager();
    this.apnProvider = null;
    this.apnConnShutdownTimer = null;
    this.pendingNotifications = 0;

    const credentials = Config.upsMap.get('apns');
    this.options = {
      token: {
        key: Buffer.from(credentials.token.key),
        keyId: credentials.token.keyId,
        teamId: credentials.token.teamId,
      },
      production: process.env.APN_PRODUCTION === 'true',
    };

    this.pushEventEmitter = new PushEventEmitter();
    this.pushEventEmitter.on('push', changeListItem => this.push(changeListItem));
  }

  /**
   * When there are no pending notification events shutdown connection to APN.
   * @private
   */
  condApnConnectionShutdown() {
    if (this.pendingNotifications === 0 && this.apnProvider) {
      this.apnProvider.shutdown();
      this.apnProvider = null;
      console.log('No pending notification left, shut down connection to APN');
    }

    this.apnConnShutdownTimer = null;
  }

  /**
   * Schedule APN connection shutdown. After calling this function the shutdown of APN
   * connection will not happen before at least 30s have passed. An already scheduled
   * shutdown will be cancelled.
   * @private
   */
  scheduleApnConnectionShutdown() {
    if (this.pendingNotifications === 0 && this.apnProvider) {
      console.log('Schedule shutdown of APN connection.');

      // If there is a timer already, cancel it first.
      if (this.apnConnShutdownTimer) {
        console.log('Will cancel existing timer before scheduling shutdown...');
        clearTimeout(this.apnConnShutdownTimer);
      }
      // Schedule connection shutdown with a delay of 10s.
      this.apnConnShutdownTimer = setTimeout(() => this.condApnConnectionShutdown(), 10000);
    }
  }

  /**
   * Event handler for push events emitted by PushEventEmitter. This handler actually
   * pushes a notification to APN.
   * @param {Object} changeListItem - Item with information on current change
   */
  push(changeListItem) {
    console.log(`Pushing for ${changeListItem.grade}`);

    this.deviceTokenManager.getDeviceTokens(changeListItem.grade)
      .then((device) => {
        if (device.docs.length > 0) {
          // For upper grades we need to send notifications per device.
          if (Config.upperGrades.includes(changeListItem.grade)) {
            // Get all device tokens, these are needed for sending the push notification.
            const devices = device.docs.map(item => ({ _id: item._id, _rev: item._rev, courseList: item.courseList }));

            devices.forEach(device => {
              console.log(`... ${device._id}`);
              const deviceTokens = [device._id];
              const revMap = new Map();
              revMap.set(device._id, device._rev);

              const deltaList = VertretungsplanHelper.delta(changeListItem, device.courseList || []);
              console.log(util.inspect(deltaList, { depth: 4 }));
              this.sendPushNotification(deviceTokens, revMap, deltaList, changeListItem.grade);
            });
          } else {
            // Get all device tokens, these are needed for sending the push notification.
            const deviceTokens = device.docs.map(item => item._id);

            // Map to lookup revision id by device token. This will be needed for housekeeping.
            const revMap = new Map();
            device.docs.forEach(device => revMap.set(device._id, device._rev));

            const deltaList = VertretungsplanHelper.delta(changeListItem);
            console.log(`...${util.inspect(deviceTokens, { depth: 1 })}`);
            console.log(util.inspect(deltaList, { depth: 4 }));
            this.sendPushNotification(deviceTokens, revMap, deltaList, changeListItem.grade);
          }
        }
      })
      .catch((err) => {
        console.log(`Processing push notification failed with rejected promise: ${err} at ${err.stack}`);
      });
  }

  /**
   * Send push notification to the given device token list. Any rejected token will
   * be removed from device-token database. revMap is used to lookup latest known
   * document revision for deletion. deltaList is sent as payload.
   * @param {Array<String>} deviceTokens
   * @param {Map<String, String>} revMap
   * @param {Array<Object>} deltaList - The deltaList for device tokens
   * @param {String} grade - Grade the push is for, for error reporting purposes only
   * @private
   */
  async sendPushNotification(deviceTokens, revMap, deltaList, grade) {
    console.log(`sendPushNotification(): ${deltaList.length}`);

    if (deltaList.length > 0) {
      this.pendingNotifications += 1;
      try {
        // Connect to APN service if not done so already.
        if (!this.apnProvider) {
          this.apnProvider = new apn.Provider(this.options);
          console.log('Got APN connection');
        }

        console.log(`# of pending notifications is ${this.pendingNotifications}`);

        // This is our push notification.
        const notification = new apn.Notification();
        notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        notification.category = 'substitution-schedule.changed';
        notification.topic = 'de.rmkrings.piusapp';
        notification.sound = 'default';
        // notification.title = 'Dein Vertretungsplan hat sich geändert!';
        notification.body = `Es gibt ${deltaList.length} Änderung${(deltaList.length > 1) ? 'en' : ''} an Deinem Vertretungsplan.`;
        notification.payload = { deltaList };

        try {
          const result = await this.apnProvider.send(notification, deviceTokens);
          console.log(result);

          const failedList = result.failed
            .filter(item => item.response)
            .map(item => ({ deviceToken: item.device, _rev: revMap.get(item.device), reason: item.response.reason }));
          await this.deviceTokenManager.housekeeping(failedList);

          this.pendingNotifications -= 1;
          this.scheduleApnConnectionShutdown();
        } catch (err) {
          console.log(`Sending APN failed with exception promise: ${err}`);
          this.pendingNotifications -= 1;
          this.scheduleApnConnectionShutdown();
        };
      } catch (err) {
        console.log(`Problem when sending push notficication for grade ${grade}: ${err}`);
      }
    }
  }
}

module.exports = Pusher;
