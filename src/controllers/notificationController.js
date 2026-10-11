const Notification = require('../models/Notification');

module.exports = {
  index(req, res) {
    res.render('notifications', { title: 'Notifications', notifications: Notification.forUser(req.user.user_id) });
  },
  open(req, res) {
    Notification.markRead(Number(req.params.id), req.user.user_id);
    const link = req.body.link && req.body.link.startsWith('/') ? req.body.link : '/notifications';
    res.redirect(link);
  },
  readAll(req, res) {
    Notification.markAllRead(req.user.user_id);
    res.redirect('/notifications');
  }
};
