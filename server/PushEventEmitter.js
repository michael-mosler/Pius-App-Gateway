const EventEmitter = require('events');

let instance;

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
