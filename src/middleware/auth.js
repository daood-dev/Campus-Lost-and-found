const crypto = require('crypto');
const User = require('../models/User');
const Notification = require('../models/Notification');

function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.unreadCount = 0;
  if (req.session.userId) {
    const user = User.findById(req.session.userId);
    if (user && user.is_active) {
      req.user = user;
      res.locals.currentUser = user;
      res.locals.unreadCount = Notification.unreadCount(user.user_id);
    } else {
      delete req.session.userId;
    }
  }
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) {
    req.session.flash = { type: 'info', text: 'Log in to continue.' };
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).render('error', { title: 'Not allowed', message: 'This area is for administrators only.' });
  }
  next();
}

/** Synchroniser-token CSRF protection. Token may arrive in body, query string (multipart forms) or header. */
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const sent = (req.body && req.body._csrf) || req.query._csrf || req.get('x-csrf-token');
    if (sent !== req.session.csrf) {
      return res.status(403).render('error', { title: 'Session expired', message: 'Your form expired. Go back, refresh the page, and try again.' });
    }
  }
  next();
}

function flash(req, type, text) {
  req.session.flash = { type, text };
}

module.exports = { loadUser, requireLogin, requireAdmin, csrf, flash };
