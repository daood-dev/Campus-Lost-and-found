const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const auth = require('../controllers/authController');
const items = require('../controllers/itemController');
const claims = require('../controllers/claimController');
const notes = require('../controllers/notificationController');
const dash = require('../controllers/dashboardController');
const admin = require('../controllers/adminController');

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype])
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, Object.prototype.hasOwnProperty.call(EXT, file.mimetype))
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).render('login', { title: 'Log in', error: 'Too many attempts. Try again in a few minutes.', email: '' }) });

const r = express.Router();

r.get('/', items.home);
r.get('/search', items.search);

r.get('/about', (req, res) => res.render('about', { title: 'About UET Campus Lost & Found' }));
r.get('/how-it-works', (req, res) => res.render('how-it-works', { title: 'How it works' }));
r.get('/safety', (req, res) => res.render('safety', { title: 'Safety and privacy' }));
r.get('/contact', (req, res) => res.render('contact', { title: 'Contact campus support', sent: false }));
r.post('/contact', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const message = String(req.body.message || '').trim();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10 || message.length > 2000) {
    return res.status(400).render('contact', { title: 'Contact campus support', sent: false, error: 'Please enter a name, valid email, and message between 10 and 2,000 characters.', values: { name, email, message } });
  }
  res.render('contact', { title: 'Contact campus support', sent: true });
});

r.get('/register', auth.showRegister);
r.post('/register', auth.register);
r.get('/login', auth.showLogin);
r.post('/login', loginLimiter, auth.login);
r.post('/logout', auth.logout);

r.get('/dashboard', requireLogin, dash.index);
r.get('/profile', requireLogin, auth.showProfile);
r.post('/profile', requireLogin, auth.updateProfile);

r.get('/report/:type(lost|found)', requireLogin, items.showNew);
r.post('/report/:type(lost|found)', requireLogin, upload.single('image'), items.create);
r.get('/items/:id(\\d+)', items.show);
r.get('/items/:id(\\d+)/edit', requireLogin, items.showEdit);
r.post('/items/:id(\\d+)/edit', requireLogin, upload.single('image'), items.update);
r.post('/items/:id(\\d+)/delete', requireLogin, items.remove);
r.post('/items/:id(\\d+)/recovered', requireLogin, items.markRecovered);
r.post('/items/:id(\\d+)/claim', requireLogin, claims.submit);
r.post('/matches/:matchId(\\d+)/:action(confirm|dismiss)', requireLogin, items.matchAction);
r.get('/claims', requireLogin, claims.mine);

r.get('/notifications', requireLogin, notes.index);
r.post('/notifications/read-all', requireLogin, notes.readAll);
r.post('/notifications/:id(\\d+)/open', requireLogin, notes.open);

r.get('/admin', requireLogin, requireAdmin, admin.dashboard);
r.get('/admin/items', requireLogin, requireAdmin, admin.items);
r.post('/admin/items/:id(\\d+)/:action(hide|unhide|delete|recovered)', requireLogin, requireAdmin, admin.moderate);
r.get('/admin/claims', requireLogin, requireAdmin, admin.claims);
r.post('/admin/claims/:id(\\d+)/review', requireLogin, requireAdmin, admin.reviewClaim);
r.get('/admin/users', requireLogin, requireAdmin, admin.users);
r.post('/admin/users/:id(\\d+)/:action(role|toggle)', requireLogin, requireAdmin, admin.userAction);

module.exports = r;
