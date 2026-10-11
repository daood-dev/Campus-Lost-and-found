const path = require('path');
const fs = require('fs');
const Item = require('../models/Item');
const Match = require('../models/Match');
const Claim = require('../models/Claim');
const bus = require('../events/eventBus');
const EVENTS = require('../events/events');
const claimService = require('../services/claimService');
const { CATEGORIES, LOCATIONS, STATUSES } = require('../config/constants');
const { flash } = require('../middleware/auth');

const today = () => new Date().toISOString().slice(0, 10);
const canManage = (user, item) => user && (user.role === 'admin' || user.user_id === item.user_id);

function validate(body, type) {
  const errors = [];
  const v = {
    title: (body.title || '').trim(),
    description: (body.description || '').trim(),
    privateDetails: (body.private_details || '').trim() || null,
    category: body.category,
    location: (body.location || '').trim(),
    itemDate: body.item_date
  };
  if (v.title.length < 3 || v.title.length > 80) errors.push('Title must be 3 to 80 characters.');
  if (v.description.length < 10 || v.description.length > 1000) errors.push('Description must be 10 to 1000 characters.');
  if (!CATEGORIES.includes(v.category)) errors.push('Choose a category.');
  if (!v.location || v.location.length > 80) errors.push('Enter the campus location.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.itemDate || '') || v.itemDate > today()) errors.push(`Enter a valid date (not in the future).`);
  if (v.privateDetails && v.privateDetails.length > 500) errors.push('Private details are limited to 500 characters.');
  return { v, errors };
}

function formView(res, type, extra = {}) {
  res.render('item-form', {
    title: type === 'Lost' ? 'Report a lost item' : 'Report a found item',
    type, categories: CATEGORIES, locations: LOCATIONS, today: today(), errors: [], values: {}, item: null, ...extra
  });
}

module.exports = {
  home(req, res) {
    res.render('home', { title: 'Campus Lost & Found', recent: Item.recent(6), stats: Item.stats() });
  },

  search(req, res) {
    const f = {
      q: (req.query.q || '').trim(), category: req.query.category || '', location: (req.query.location || '').trim(),
      type: req.query.type || '', status: req.query.status || '', from: req.query.from || '', to: req.query.to || ''
    };
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 12;
    const { rows, total } = Item.search({ ...f, limit, offset: (page - 1) * limit });
    res.render('search', {
      title: 'Search items', items: rows, total, filters: f, page, pages: Math.max(1, Math.ceil(total / limit)),
      categories: CATEGORIES, statuses: STATUSES
    });
  },

  showNew(req, res) {
    formView(res, req.params.type === 'lost' ? 'Lost' : 'Found');
  },

  create(req, res) {
    const type = req.params.type === 'lost' ? 'Lost' : 'Found';
    const { v, errors } = validate(req.body, type);
    if (errors.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).render('item-form', {
        title: type === 'Lost' ? 'Report a lost item' : 'Report a found item', type, categories: CATEGORIES,
        locations: LOCATIONS, today: today(), errors, values: req.body, item: null
      });
    }
    const item = Item.create({ ...v, userId: req.user.user_id, reportType: type, imageUrl: req.file ? `/uploads/${req.file.filename}` : null });
    bus.emit(type === 'Lost' ? EVENTS.LOST_ITEM_REPORTED : EVENTS.FOUND_ITEM_REPORTED, { itemId: item.item_id });
    flash(req, 'success', 'Report saved. We will notify you if a possible match appears.');
    res.redirect(`/items/${item.item_id}`);
  },

  show(req, res) {
    const item = Item.findById(req.params.id);
    const admin = req.user && req.user.role === 'admin';
    if (!item || (item.is_hidden && !canManage(req.user, item))) {
      return res.status(404).render('error', { title: 'Not found', message: 'This report does not exist or is no longer visible.' });
    }
    const owner = canManage(req.user, item);
    const matches = owner ? Match.forItem(item.item_id) : [];
    const myClaim = req.user ? Claim.existing(item.item_id, req.user.user_id) : null;
    res.render('item', {
      title: item.title, item, owner, admin, matches, myClaim,
      claims: admin ? Claim.forItem(item.item_id) : [],
      canClaim: !!req.user && item.report_type === 'Found' && item.user_id !== req.user.user_id &&
        !['Claimed', 'Recovered'].includes(item.status) && !myClaim
    });
  },

  showEdit(req, res) {
    const item = Item.findById(req.params.id);
    if (!item || !canManage(req.user, item)) return res.status(403).render('error', { title: 'Not allowed', message: 'You can only edit your own reports.' });
    formView(res, item.report_type, {
      item, values: { title: item.title, description: item.description, private_details: item.private_details, category: item.category, location: item.location, item_date: item.item_date }
    });
  },

  update(req, res) {
    const item = Item.findById(req.params.id);
    if (!item || !canManage(req.user, item)) return res.status(403).render('error', { title: 'Not allowed', message: 'You can only edit your own reports.' });
    const { v, errors } = validate(req.body, item.report_type);
    if (errors.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return formView(res.status(400), item.report_type, { item, errors, values: req.body });
    }
    Item.update(item.item_id, { ...v, imageUrl: req.file ? `/uploads/${req.file.filename}` : null });
    flash(req, 'success', 'Report updated.');
    res.redirect(`/items/${item.item_id}`);
  },

  remove(req, res) {
    const item = Item.findById(req.params.id);
    if (!item || !canManage(req.user, item)) return res.status(403).render('error', { title: 'Not allowed', message: 'You can only delete your own reports.' });
    if (item.image_url) fs.unlink(path.join(__dirname, '../../', item.image_url), () => {});
    Item.remove(item.item_id);
    flash(req, 'success', 'Report deleted.');
    res.redirect('/dashboard');
  },

  /** Owners may close their own *lost* report once they have the item back. Found items need an approved claim (admin). */
  markRecovered(req, res) {
    const item = Item.findById(req.params.id);
    if (!item || !canManage(req.user, item)) return res.status(403).render('error', { title: 'Not allowed', message: 'You cannot change this report.' });
    if (item.report_type === 'Found' && req.user.role !== 'admin') {
      flash(req, 'error', 'Only an administrator can mark a found item as recovered, after verifying ownership.');
      return res.redirect(`/items/${item.item_id}`);
    }
    const result = claimService.markRecovered({ itemId: item.item_id, adminId: req.user.role === 'admin' ? req.user.user_id : null });
    flash(req, result.error ? 'error' : 'success', result.error || 'Marked as recovered.');
    res.redirect(`/items/${item.item_id}`);
  },

  matchAction(req, res) {
    const match = Match.findById(req.params.matchId);
    if (!match) return res.status(404).render('error', { title: 'Not found', message: 'Match not found.' });
    const lost = Item.findById(match.lost_item_id);
    const found = Item.findById(match.found_item_id);
    if (!(req.user.role === 'admin' || req.user.user_id === lost.user_id || req.user.user_id === found.user_id)) {
      return res.status(403).render('error', { title: 'Not allowed', message: 'You are not part of this match.' });
    }
    const dismiss = req.params.action === 'dismiss';
    Match.setStatus(match.match_id, dismiss ? 'Dismissed' : 'Confirmed');
    if (dismiss) {
      [lost, found].forEach((it) => {
        if (it.status === 'Matched' && Match.activeCountFor(it.item_id) === 0) Item.setStatus(it.item_id, 'Open');
      });
    }
    flash(req, 'success', dismiss ? 'Match dismissed.' : 'Match confirmed. If this is yours, submit a claim on the found item.');
    res.redirect(req.body.back || `/items/${lost.item_id}`);
  }
};
