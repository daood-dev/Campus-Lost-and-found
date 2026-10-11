const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { flash } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = {
  showRegister(req, res) {
    res.render('register', { title: 'Create account', values: {}, errors: [] });
  },

  register(req, res) {
    const { full_name = '', email = '', password = '', role = 'student' } = req.body;
    const errors = [];
    if (full_name.trim().length < 2) errors.push('Enter your full name.');
    if (!EMAIL_RE.test(email)) errors.push('Enter a valid email address.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.push('Password must be at least 8 characters and include a letter and a number.');
    }
    if (!['student', 'staff'].includes(role)) errors.push('Choose student or staff.');
    if (!errors.length && User.findByEmailWithHash(email)) errors.push('An account with this email already exists.');
    if (errors.length) {
      return res.status(400).render('register', { title: 'Create account', values: { full_name, email, role }, errors });
    }
    const user = User.create({ fullName: full_name.trim(), email: email.trim(), passwordHash: bcrypt.hashSync(password, 10), role });
    req.session.regenerate(() => {
      req.session.userId = user.user_id;
      flash(req, 'success', 'Welcome! Your account is ready.');
      res.redirect('/dashboard');
    });
  },

  showLogin(req, res) {
    res.render('login', { title: 'Log in', error: null, email: '' });
  },

  login(req, res) {
    const { email = '', password = '' } = req.body;
    const user = User.findByEmailWithHash(email);
    const ok = user && user.is_active && bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      return res.status(401).render('login', { title: 'Log in', error: 'Email or password is incorrect.', email });
    }
    const returnTo = req.session.returnTo && req.session.returnTo.startsWith('/') && !req.session.returnTo.startsWith('//') ? req.session.returnTo : '/dashboard';
    req.session.regenerate(() => {
      req.session.userId = user.user_id;
      res.redirect(returnTo);
    });
  },

  logout(req, res) {
    req.session.destroy((err) => {
      res.clearCookie('clf.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      if (err) return res.status(500).redirect('/login');
      return res.redirect('/');
    });
  },

  showProfile(req, res) {
    res.render('profile', { title: 'Your profile', errors: [] });
  },

  updateProfile(req, res) {
    const { full_name = '', current_password = '', new_password = '' } = req.body;
    const errors = [];
    if (full_name.trim().length < 2) errors.push('Enter your full name.');
    if (new_password) {
      const row = User.findByEmailWithHash(req.user.email);
      if (!bcrypt.compareSync(current_password, row.password_hash)) errors.push('Current password is incorrect.');
      if (new_password.length < 8 || !/[A-Za-z]/.test(new_password) || !/\d/.test(new_password)) {
        errors.push('New password must be at least 8 characters with a letter and a number.');
      }
    }
    if (errors.length) return res.status(400).render('profile', { title: 'Your profile', errors });
    User.updateProfile(req.user.user_id, full_name.trim());
    if (new_password) User.updatePassword(req.user.user_id, bcrypt.hashSync(new_password, 10));
    flash(req, 'success', 'Profile updated.');
    res.redirect('/profile');
  }
};
