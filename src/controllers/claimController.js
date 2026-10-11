const claimService = require('../services/claimService');
const Claim = require('../models/Claim');
const { flash } = require('../middleware/auth');

module.exports = {
  submit(req, res) {
    const details = (req.body.claim_details || '').trim();
    if (details.length < 15) {
      flash(req, 'error', 'Describe something only the owner would know (at least 15 characters): marks, contents, serial number.');
      return res.redirect(`/items/${req.params.id}`);
    }
    const result = claimService.submit({ itemId: Number(req.params.id), claimantId: req.user.user_id, details });
    flash(req, result.error ? 'error' : 'success', result.error || 'Claim submitted. An administrator will review it.');
    res.redirect(`/items/${req.params.id}`);
  },

  mine(req, res) {
    res.render('my-claims', { title: 'Your claims', claims: Claim.byUser(req.user.user_id) });
  }
};
