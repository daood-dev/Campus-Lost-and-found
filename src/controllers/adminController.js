const Item = require('../models/Item');
const User = require('../models/User');
const Claim = require('../models/Claim');
const Audit = require('../models/Audit');
const claimService = require('../services/claimService');
const bus = require('../events/eventBus');
const EVENTS = require('../events/events');
const { CATEGORIES, STATUSES } = require('../config/constants');
const { flash } = require('../middleware/auth');

module.exports = {
  dashboard(req, res) {
    res.render('admin/dashboard', { title: 'Admin dashboard', stats: Item.stats(), audit: Audit.recent(), pending: Claim.all('Pending').slice(0, 5) });
  },

  items(req, res) {
    const f = { q: (req.query.q || '').trim(), type: req.query.type || '', status: req.query.status || '', category: req.query.category || '' };
    const { rows, total } = Item.search({ ...f, includeHidden: true, limit: 100 });
    res.render('admin/items', { title: 'Moderate reports', items: rows, total, filters: f, categories: CATEGORIES, statuses: STATUSES });
  },

  moderate(req, res) {
    const id = Number(req.params.id);
    const item = Item.findById(id);
    if (!item) return res.status(404).render('error', { title: 'Not found', message: 'Report not found.' });
    const action = req.params.action;
    if (action === 'delete') {
      Item.remove(id);
      Audit.record(req.user.user_id, 'deleted report', `item #${id} "${item.title}"`);
      flash(req, 'success', 'Report deleted.');
    } else if (action === 'hide' || action === 'unhide') {
      Item.setHidden(id, action === 'hide');
      Audit.record(req.user.user_id, `${action} report`, `item #${id} "${item.title}"`);
      bus.emit(EVENTS.REPORT_MODERATED, { itemId: id, action: action === 'hide' ? 'hidden' : 'restored' });
      flash(req, 'success', action === 'hide' ? 'Report hidden from public listings.' : 'Report is visible again.');
    } else if (action === 'recovered') {
      const r = claimService.markRecovered({ itemId: id, adminId: req.user.user_id });
      flash(req, r.error ? 'error' : 'success', r.error || 'Marked as recovered.');
    }
    res.redirect(req.body.back && req.body.back.startsWith('/') ? req.body.back : '/admin/items');
  },

  claims(req, res) {
    res.render('admin/claims', { title: 'Review claims', claims: Claim.all() });
  },

  reviewClaim(req, res) {
    const r = claimService.review({
      claimId: Number(req.params.id), adminId: req.user.user_id,
      decision: req.body.decision === 'approve' ? 'approve' : 'reject', note: (req.body.note || '').trim().slice(0, 300)
    });
    flash(req, r.error ? 'error' : 'success', r.error || `Claim ${r.claim.status.toLowerCase()}.`);
    res.redirect('/admin/claims');
  },

  users(req, res) {
    res.render('admin/users', { title: 'Manage users', users: User.all() });
  },

  userAction(req, res) {
    const id = Number(req.params.id);
    const target = User.findById(id);
    if (!target) return res.status(404).render('error', { title: 'Not found', message: 'User not found.' });
    if (id === req.user.user_id) {
      flash(req, 'error', 'You cannot change your own role or status.');
      return res.redirect('/admin/users');
    }
    if (req.params.action === 'role' && ['student', 'staff', 'admin'].includes(req.body.role)) {
      User.setRole(id, req.body.role);
      Audit.record(req.user.user_id, `set role ${req.body.role}`, `user #${id} ${target.email}`);
    } else if (req.params.action === 'toggle') {
      User.setActive(id, !target.is_active);
      Audit.record(req.user.user_id, target.is_active ? 'deactivated user' : 'reactivated user', `user #${id} ${target.email}`);
    }
    flash(req, 'success', 'User updated.');
    res.redirect('/admin/users');
  }
};
