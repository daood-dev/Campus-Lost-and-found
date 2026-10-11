const matching = require('./handlers/matchingHandler');
const notifications = require('./handlers/notificationHandler');
const bus = require('./eventBus');

function registerHandlers() {
  bus.clear();
  matching.register();
  notifications.register();
}

module.exports = { registerHandlers, bus };
