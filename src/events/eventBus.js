const { getDb } = require('../config/db');

/**
 * Lightweight in-process event bus.
 *  - every published event is persisted to event_log (audit trail)
 *  - handlers run asynchronously, after the caller's request has finished its work
 *  - a failing handler never breaks the request or other handlers
 * Swap for a broker (RabbitMQ / Redis streams) by keeping the same publish/subscribe API.
 */
class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  subscribe(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(handler);
  }

  clear() {
    this.handlers.clear();
  }

  async publish(type, payload = {}) {
    try {
      getDb().prepare('INSERT INTO event_log (event_type, payload) VALUES (?, ?)').run(type, JSON.stringify(payload));
    } catch (err) {
      console.error('[event-bus] could not log event', type, err.message);
    }
    await new Promise((resolve) => setImmediate(resolve));
    const list = this.handlers.get(type) || [];
    const results = await Promise.allSettled(list.map((h) => h(payload)));
    results.forEach((r) => {
      if (r.status === 'rejected') console.error(`[event-bus] handler failed for ${type}:`, r.reason);
    });
  }

  /** Fire-and-forget for controllers: the HTTP response does not wait for handlers. */
  emit(type, payload) {
    this.publish(type, payload).catch((e) => console.error('[event-bus]', e));
  }
}

module.exports = new EventBus();
