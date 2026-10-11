/* Demo data: node scripts/seed.js */
const bcrypt = require('bcryptjs');
const { init } = require('../src/config/db');
init();
const User = require('../src/models/User');
const Item = require('../src/models/Item');
const bus = require('../src/events/eventBus');
const EVENTS = require('../src/events/events');
const { registerHandlers } = require('../src/events');

(async () => {
  registerHandlers();
  if (User.count() > 0) { console.log('Database already has users; skipping seed.'); return; }
  const mk = (fullName, email, role, pw) => User.create({ fullName, email, passwordHash: bcrypt.hashSync(pw, 10), role });
  mk('Campus Admin', 'admin@campus.edu', 'admin', 'Admin1234');
  const ayesha = mk('Ayesha Khan', 'ayesha@campus.edu', 'student', 'Student123');
  const bilal = mk('Bilal Ahmed', 'bilal@campus.edu', 'student', 'Student123');
  mk('Dr. Sana Malik', 'sana@campus.edu', 'staff', 'Teacher123');

  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const lost = Item.create({ userId: ayesha.user_id, reportType: 'Lost', title: 'Black leather wallet', category: 'Wallet', location: 'Main Library',
    description: 'Black leather wallet with a small brass zipper, lost near the reading hall.', privateDetails: 'Student card inside; blue sticker on the back.', itemDate: day(2) });
  await bus.publish(EVENTS.LOST_ITEM_REPORTED, { itemId: lost.item_id });
  const found = Item.create({ userId: bilal.user_id, reportType: 'Found', title: 'Black wallet', category: 'Wallet', location: 'Main Library',
    description: 'Found a black leather wallet on a table in the library reading hall.', privateDetails: 'Has a blue sticker on the back and a student card.', itemDate: day(1) });
  await bus.publish(EVENTS.FOUND_ITEM_REPORTED, { itemId: found.item_id });
  const keys = Item.create({ userId: bilal.user_id, reportType: 'Found', title: 'Set of keys with red lanyard', category: 'Keys', location: 'Cafeteria',
    description: 'Three keys on a red lanyard, left near the cafeteria counter.', itemDate: day(3) });
  await bus.publish(EVENTS.FOUND_ITEM_REPORTED, { itemId: keys.item_id });
  console.log('Seeded. Admin: admin@campus.edu / Admin1234   Student: ayesha@campus.edu / Student123');
})();
