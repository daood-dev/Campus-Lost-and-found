const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

module.exports = {
  index(req, res) {
    const items = Item.byUser(req.user.user_id);
    const matches = items.flatMap((i) => Match.forItem(i.item_id).filter((m) => m.status === 'Suggested').map((m) => ({ ...m, for_item: i })));
    const seen = new Set();
    const uniqueMatches = matches.filter((m) => (seen.has(m.match_id) ? false : seen.add(m.match_id)));
    res.render('dashboard', {
      title: 'Dashboard', items, matches: uniqueMatches,
      claims: Claim.byUser(req.user.user_id).slice(0, 5),
      notifications: Notification.forUser(req.user.user_id, 5)
    });
  }
};
