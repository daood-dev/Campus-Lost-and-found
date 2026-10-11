/**
 * Item matching: returns a 0-100 similarity score. A score is evidence, never proof of ownership.
 *   category  35  (must be equal, otherwise the pair is rejected)
 *   text      35  (keyword overlap between title + description)
 *   location  20  (same place = 20, shared word = 10)
 *   date      10  (found on/after the loss date; closer is better)
 */
const STOP = new Set(['the', 'and', 'with', 'for', 'was', 'has', 'have', 'near', 'from', 'that', 'this', 'lost', 'found', 'item', 'its', 'are', 'but', 'not', 'very']);

function tokens(text) {
  return new Set(
    String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t))
  );
}

function textScore(a, b) {
  const ta = tokens(`${a.title} ${a.description}`);
  const tb = tokens(`${b.title} ${b.description}`);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach((t) => { if (tb.has(t)) shared += 1; });
  return (shared / Math.min(ta.size, tb.size)) * 35;
}

function locationScore(a, b) {
  const la = String(a.location).trim().toLowerCase();
  const lb = String(b.location).trim().toLowerCase();
  if (la === lb) return 20;
  const ta = tokens(la);
  const tb = tokens(lb);
  for (const t of ta) if (tb.has(t)) return 10;
  return 0;
}

function dateScore(lost, found) {
  const diff = (new Date(found.item_date) - new Date(lost.item_date)) / 86400000;
  if (Number.isNaN(diff) || diff < -1) return 0; // found well before it was lost: implausible
  if (diff <= 1) return 10;
  if (diff <= 7) return 6;
  if (diff <= 30) return 2;
  return 0;
}

function scoreMatch(lost, found) {
  if (lost.category !== found.category) return 0;
  return Math.round(35 + textScore(lost, found) + locationScore(lost, found) + dateScore(lost, found));
}

module.exports = { scoreMatch, tokens };
