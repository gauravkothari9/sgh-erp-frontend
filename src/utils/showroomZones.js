// Mirrors backend/config/showroom.js — which zones each branch has.
export const SHOWROOM_ZONES = {
  Kakani: ['A', 'B', 'C'],
  Jhalamand: ['A', 'B', 'C', 'D'],
};

export const SHOWROOM_BRANCHES = Object.keys(SHOWROOM_ZONES);

// Suggested collections — mirrors backend/config/showroom.js. Free text, so a
// product may carry a collection outside this list.
export const SHOWROOM_COLLECTIONS = [
  'Chairs', 'Almirahs', 'Consoles', 'Sideboards', 'Bedsides', 'Beds',
  'Tables', 'Dining Sets', 'Cabinets', 'Chests', 'Benches', 'Mirrors', 'Decor',
];

// Units of a product sitting in one specific zone.
export const zoneQtyOf = (product, branch, zone) =>
  (product?.locations || [])
    .filter((l) => l.branch === branch && l.zone === zone)
    .reduce((s, l) => s + (l.qty || 0), 0);

// Units across every zone — the cap when ordering.
export const totalQtyOf = (product) =>
  product?.totalQty ?? (product?.locations || []).reduce((s, l) => s + (l.qty || 0), 0);

// "Jhalamand A · 5, Jhalamand C · 10, Kakani A · 5"
export const stockSummary = (product) =>
  (product?.locations || [])
    .map((l) => `${l.branch} ${l.zone} · ${l.qty}`)
    .join(', ');
