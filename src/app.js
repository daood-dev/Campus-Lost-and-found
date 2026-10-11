const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const { loadUser, csrf } = require('./middleware/auth');
const routes = require('./routes');
const { registerHandlers } = require('./events');

function createApp() {
  registerHandlers();
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ['https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null
      }
    }
  }));
  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { index: false, dotfiles: 'deny' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(session({
    name: 'clf.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
  }));
  app.use(loadUser);
  app.use(csrf);
  app.use((req, res, next) => {
    res.locals.fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
    res.locals.slug = (s) => String(s).toLowerCase().replace(/[^a-z]+/g, '-');
    next();
  });

  app.use(routes);

  app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'That page does not exist.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && (err.code === 'LIMIT_FILE_SIZE')) {
      return res.status(400).render('error', { title: 'Image too large', message: 'Images must be 2 MB or smaller.' });
    }
    console.error(err);
    res.status(500).render('error', { title: 'Something went wrong', message: 'An unexpected error occurred. Please try again.' });
  });
  return app;
}

module.exports = { createApp };
