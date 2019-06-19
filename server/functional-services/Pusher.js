const util = require('util');
const _ = require('underscore');
const APN = require('apn');
const firebase = require('firebase-admin');
const clone = require('clone');
const datetime = require('date-and-time');
const Config = require('../core-services/Config');
const PushEventEmitter = require('./PushEventEmitter');
const DeviceTokenManager = require('../core-services/DeviceTokenManager');
const VertretungsplanHelper = require('../helper/VertretungsplanHelper');

let instance;

/**
 * A device that has been registsred with a push notification service. We support APN and FCM.
 * @property {String} token - Messaging provider device token (r/o)
 * @property {String} rev - Database revision of device document (r/o)
 * @property {String} messagingProvider - Messaging provider device has been registered with.
 * @private
 */
class Device {
  /**
   * Create a new device. Devices are identified by a device token. This token is generated by
   * the messaging provider this device has been registered for.
   * @param {String} token - Device token.
   * @param {String} rev - Document revision (needed for deletion of outdated tokens)
   * @param {String} messagingProvider - Messaging provider for device (r/o).
   */
  constructor(token, rev, messagingProvider) {
    this._token = token;
    this._rev = rev;
    this._messagingProvider = messagingProvider || 'apn';
  }

  get token() {
    return this._token;
  }

  get rev() {
    return this._rev;
  }

  get messagingProvider() {
    return this._messagingProvider;
  }
}

/**
 * A push item that can be passed to sendPushNotificaton() method.
 * @property {String} grade - Grade item has been created for (r/o).
 * @property {Array<Device>} devices - List of all devices this item is intended for (r/o).
 * @property {Array<Object>} deltaList - Delta list that has been computed for this item (r/o).
 * @property {Array<String>} deltaList - An array containing all device tokens of devices that have been added to this item (r/o).
 * @private
 */
class PushItem {
  /**
   * @param {String} grade - Grade for which information is provided.
   * @param {{Array<Object>}} deltaList - Changes in schedule for grade
   */
  constructor(grade, deltaList) {
    this._grade = grade;
    this._deltaList = deltaList;
    this._devices = [];
    this._revMap = new Map();
  }

  get grade() {
    return this._grade;
  }

  get deltaList() {
    return this._deltaList;
  }

  /**
   * @param {Device} device - Device to add to push item.
   */
  add(device) {
    this._devices.push(device);
    this._revMap.set(device.token, device.rev);
  }

  get devices() {
    return this._devices;
  }

  get deviceTokens() {
    return this._devices.map(device => device.token);
  }

  /**
   * Returns database document rev for the given device token.
   * @param {String} token - Device token the rev is requested for (r/o).
   */
  revForToken(token) {
    return this._revMap.get(token);
  }

  /**
   * Clones this instance and returns a new instance that contains devices only for
   * the given messaging provider.
   * @param {String} messagingProvider - Messaging provider for which devices shall be kept in clone.
   * @returns {PushItem}
   */
  for(messagingProvider) {
    const pushItemFor = clone(this);
    pushItemFor._devices = pushItemFor._devices.filter(device => device.messagingProvider === messagingProvider);
    return pushItemFor;
  }
}

/**
 * This class on instantiation registers on 'push' event. When such an event is received
 * a push notification is sent to all devices that match the events grade property.
 */
class Pusher {
  constructor() {
    if (!instance) {
      this.deviceTokenManager = new DeviceTokenManager();
      this.apnProvider = null;
      this.apnConnShutdownTimer = null;
      this.pendingApnNotifications = 0;

      const apnCredentials = Config.upsMap.get('apns');
      this.apnOptions = {
        token: {
          key: Buffer.from(apnCredentials.token.key),
          keyId: apnCredentials.token.keyId,
          teamId: apnCredentials.token.teamId,
        },
        production: process.env.APN_PRODUCTION === 'true',
      };

      const serviceAccount = Config.upsMap.get('fcm');
      firebase.initializeApp({
        credential: firebase.credential.cert(serviceAccount),
        databaseURL: 'https://pius-app.firebaseio.com',
      });

      this.pushEventEmitter = new PushEventEmitter();
      this.pushEventEmitter.on('push', changeListItem => this.push(changeListItem));

      instance = this;
    }

    return instance;
  }

  /**
   * When there are no pending notification events shutdown connection to APN.
   * @private
   */
  condApnConnectionShutdown() {
    if (this.pendingApnNotifications === 0 && this.apnProvider) {
      this.apnProvider.shutdown();
      this.apnProvider = null;
      console.log('APNS: No pending notification left, will shut down connection');
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
    if (this.pendingApnNotifications === 0 && this.apnProvider) {
      console.log('APNS: Schedule shutdown of APN connection.');

      // If there is a timer already, cancel it first.
      if (this.apnConnShutdownTimer) {
        console.log('APNS: Will cancel existing timer before scheduling shutdown...');
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
            const devices = device.docs.map(item => ({ _id: item._id, _rev: item._rev, courseList: item.courseList, messagingProvider: item.messagingProvider }));

            devices.forEach(device => {
              const deltaList = VertretungsplanHelper.delta(changeListItem, device.courseList || []);
              const pushItem = new PushItem(changeListItem.grade, deltaList);
              pushItem.add(new Device(device._id, device._rev, device.messagingProvider));
              this.sendApnPushNotification(pushItem);
              this.sendFcmPushNotification(pushItem.for('fcm'));
            });
          } else {
            const deltaList = VertretungsplanHelper.delta(changeListItem);
            const pushItem = new PushItem(changeListItem.grade, deltaList);
            device.docs.forEach(device => pushItem.add(new Device(device._id, device._rev, device.messagingProvider)));
            this.sendApnPushNotification(pushItem.for('apn'));
            this.sendFcmPushNotification(pushItem.for('fcm'));
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
   * @param {PushItem} pushItem
   * @private
   */
  async sendApnPushNotification(pushItem) {
    console.log(`APNS: sendPushNotification(): ${pushItem.deltaList.length}`);
    console.log(`APNS: ...${util.inspect(pushItem.devices, { depth: 2 })}`);
    console.log(`APNS: ${util.inspect(pushItem.deltaList, { depth: 4 })}`);

    if (pushItem.devices.length > 0 && pushItem.deltaList.length > 0) {
      this.pendingApnNotifications += 1;
      try {
        // Connect to APN service if not done so already.
        if (!this.apnProvider) {
          this.apnProvider = new APN.Provider(this.apnOptions);
          console.log('APNS: Got connection');
        }

        console.log(`APNS: # of pending notifications is ${this.pendingApnNotifications}`);

        // This is our push notification.
        const notification = new APN.Notification();
        notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        notification.category = 'substitution-schedule.changed';
        notification.topic = 'de.rmkrings.piusapp';
        notification.sound = 'default';
        notification.body = `Es gibt ${pushItem.deltaList.length} Änderung${(pushItem.deltaList.length > 1) ? 'en' : ''} an Deinem Vertretungsplan.`;
        notification.payload = { deltaList: pushItem.deltaList };

        try {
          const result = await this.apnProvider.send(notification, pushItem.deviceTokens);
          console.log(`APNS: ${util.inspect(result, { depth: 4 })}`);

          const failedList = result.failed
            .filter(item => item.response)
            .map(item => ({ deviceToken: item.device, _rev: pushItem.revForToken(item.device), reason: item.response.reason }));
          await this.deviceTokenManager.housekeeping(failedList);

          this.pendingApnNotifications -= 1;
          this.scheduleApnConnectionShutdown();
        } catch (err) {
          console.log(`APNS: Sending failed with exception promise: ${err}`);
          this.pendingApnNotifications -= 1;
          this.scheduleApnConnectionShutdown();
        };
      } catch (err) {
        console.log(`APNS: Problem when sending push notficication for grade ${pushItem.grade}: ${err}`);
      }
    }
  }

  /**
   * Checks if errorInfo indicates that an invalid device token was received by FCM.
   * @param {Object} fcmError - FCM errorInfo object
   * @returns {Boolean} true when errorInfo indicates an invalid device token error.
   * @private
   */
  static fcmInvalidDeviceTokenError(fcmError) {
    const { errorInfo: { code } = { code: '' } } = fcmError;
    return [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ].includes(code);
  }

  /**
   * Send a push item using the FCM messaging provider. Push item must contain FCM devices only.
   * @param {PushItem} pushItem - Send push item using fcm messaging provider.
   * @private
   */
  async sendFcmPushNotification(pushItem) {
    console.log(`FCM: sendPushNotification(): ${pushItem.deltaList.length}`);
    console.log(`FCM: ... ${util.inspect(pushItem.devices, { depth: 2 })}`);
    console.log(`FCM: ${util.inspect(pushItem.deltaList, { depth: 4 })}`);

    const now = `${datetime.format(new Date(), 'YYYY-MM-DDTHH:mm:ss', true)}Z`;

    if (pushItem.devices.length > 0 && pushItem.deltaList.length > 0) {
      const data = JSON.stringify(pushItem.deltaList);
      const chunks = _.chunk(pushItem.deviceTokens, 100);
      chunks.forEach(async chunk => {
        try {
          const message = {
            tokens: chunk,
            data: { deltaList: data, timestamp: now },
            android: {
              ttl: 1000 * 60 * 60,
              notification: {
                icon: 'ic_notification',
                color: '#699FCD',
                clickAction: 'com.rmkrings.SCHEDULE_CHANGED',
              },
            },
            notification: {
              title: 'Pius-App',
              body: `Es gibt ${pushItem.deltaList.length} Änderung${(pushItem.deltaList.length > 1) ? 'en' : ''} an Deinem Vertretungsplan.`,
            },
          };

          const response = await firebase.messaging().sendMulticast(message);
          console.log(`FCM: ${util.inspect(response, { depth: 6 })}`);

          if (response.failureCount > 0) {
            const failedList = [];
            response.responses.forEach((item, index) => {
              if (!item.success && Pusher.fcmInvalidDeviceTokenError(item.error)) {
                failedList.push({ deviceToken: chunk[index], _rev: pushItem.revForToken(chunk[index]), reason: item.error.errorInfo.message });
              }
            });

            await this.deviceTokenManager.housekeeping(failedList);
          }
        } catch (err) {
          console.log(`FCM: Problem when sending push notficication for grade ${pushItem.grade}: ${err}`);
        }
      });
    }
  }
}

module.exports = Pusher;
