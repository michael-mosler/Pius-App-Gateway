const apn = require('apn');
const Config = require('./Config');
const PushEventEmitter = require('./PushEventEmitter');
const DeviceTokenManager = require('./DeviceTokenManager');
const VertretungsplanHelper = require('./VertretungsplanHelper');

/**
 * This class on instantiation registers on 'push' event. When such an event is received
 * a push notification is sent to all devices that match the events grade property.
 */
class Pusher {
  constructor() {
    this.deviceTokenManager = new DeviceTokenManager();
    this.apnProvider = null;
    this.pendingNotifications = 0;

    const credentials = Config.upsMap.get('apns');
    this.options = {
      token: {
        key: Buffer.from(credentials.token.key),
        keyId: credentials.token.keyId,
        teamId: credentials.token.teamId,
      },
    };

    this.pushEventEmitter = new PushEventEmitter();
    this.pushEventEmitter.on('push', (changeListItem) => this.push(changeListItem));
  }

  /**
   * Remove all device token for which APNS has reported an error.
   * @param {Array<Object>} failedList
   * @private
   */
  async housekeeping(failedList) {
    await this.deviceTokenManager.housekeeping(failedList);
  }

  /**
   * When there are no pending notification events shutdown connection to APN.
   * @private
   */
  condApnConnectionShutdown() {
    if (this.pendingNotifications === 0 && this.apnProvider) {
      console.log(`No pending notification left, shutting down connection to APN`);
      this.apnProvider.shutdown();
      this.apnProvider = null;
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
          const deltaList = VertretungsplanHelper.delta(changeListItem);

          if (deltaList.length > 0) {
            this.pendingNotifications += 1;
            console.log(`# of pending notifications is ${this.pendingNotifications}`);

            // Connect to APN service if not done so already.
            if (!this.apnProvider) {
              this.apnProvider = new apn.Provider(this.options);
            }

            // Get all device tokens, these are needed for sending the push notification.
            const deviceTokens = device.docs.map(item => item._id);

            // Map to lookup revision id by device token. This will be needed for housekeeping.
            const revMap = new Map();
            device.docs.forEach(item => revMap.set(item._id, item._rev));

            // This is our push notification.
            const notification = new apn.Notification();
            notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
            notification.category = 'substitution-schedule.changed';
            notification.topic = 'de.rmkrings.piusapp';
            notification.sound = 'default';
            notification.title = 'Dein Vertretungsplan hat sich geändert!';
            notification.body = `Es gibt ${deltaList.length} Änderung${(deltaList.count > 1) ? 'en' : ''} an Deinem Vertretungsplan.`;
            notification.payload = { deltaList };

            this.apnProvider.send(notification, deviceTokens)
              .then((result) => {
                console.log(result);

                const failedList = result.failed
                  .filter(item => item.response)
                  .map(item => ({ deviceToken: item.device, _rev: revMap.get(item.device), reason: item.response.reason }));
                this.housekeeping(failedList);

                this.pendingNotifications -= 1;
                this.condApnConnectionShutdown();
              })
              .catch((err) => {
                process.stderr.write(`Sending APN failed with rejected promise: ${err}`);
                this.pendingNotifications -= 1;
                this.condApnConnectionShutdown();
              });
          }
        }
      })
      .catch((err) => {
        process.stderr.write(`Getting device token failed with rejected promise: ${err}`);
      });
  }
}

module.exports = Pusher;
