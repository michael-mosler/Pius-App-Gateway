const EventEmitter = require('events');

let instance;

/**
 * Extension of EventEmitter which signals that
 * a push should occur.
 * @extends {EventEmitter}
 */
class PushEventEmitter extends EventEmitter {
  constructor() {
    if (!instance) {
      super();
      instance = this;
    }

    return instance;
  }
}

module.exports = PushEventEmitter;
