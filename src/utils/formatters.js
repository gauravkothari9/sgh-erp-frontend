import { format, formatDistanceToNow } from 'date-fns';

// ─── Currency ─────────────────────────────────────────────────────────────────
export const formatCurrency = (amount, currency = 'USD', compact = false) => {
  if (amount === null || amount === undefined) return '—';
  const num = Number(amount);
  if (isNaN(num)) return '—';

  const symbols = {
    USD: '$', EUR: '€', GBP: '£', AED: 'AED ', INR: '₹',
    AUD: 'A$', CAD: 'C$', SGD: 'S$',
  };

  const symbol = symbols[currency] || `${currency} `;

  if (compact && num >= 1000) {
    const val = num >= 1000000 ? `${(num / 1000000).toFixed(1)}M` : `${(num / 1000).toFixed(1)}K`;
    return `${symbol}${val}`;
  }

  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── Currency symbol only ─────────────────────────────────────────────────────
export const getCurrencySymbol = (currency = 'USD') => {
  const symbols = {
    USD: '$', EUR: '€', GBP: '£', AED: 'AED', INR: '₹',
    AUD: 'A$', CAD: 'C$', SGD: 'S$',
  };
  return symbols[currency] || currency;
};

// ─── Date ─────────────────────────────────────────────────────────────────────
export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '—';
  try {
    return format(new Date(date), fmt);
  } catch {
    return '—';
  }
};

export const formatDateTime = (date) => formatDate(date, 'dd MMM yyyy, HH:mm');

export const timeAgo = (date) => {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '—';
  }
};

// ─── Numbers ─────────────────────────────────────────────────────────────────
export const formatCBM = (cbm) => {
  if (!cbm) return '—';
  return `${Number(cbm).toFixed(3)} m³`;
};

export const formatWeight = (weight) => {
  if (!weight) return '—';
  return `${Number(weight).toFixed(2)} kg`;
};

// ─── Order status badge config ────────────────────────────────────────────────
export const ORDER_STATUS_CONFIG = {
  Draft:          { label: 'Draft',           color: 'bg-gray-100 text-gray-600',         dot: 'bg-gray-400' },
  Finalized:      { label: 'Finalized',       color: 'bg-sky-100 text-sky-700',           dot: 'bg-sky-500' },
  Pending:        { label: 'Pending',          color: 'bg-amber-100 text-amber-700',       dot: 'bg-amber-500' },
  'In Production':{ label: 'In Production',    color: 'bg-blue-100 text-blue-700',         dot: 'bg-blue-500' },
  QC:             { label: 'QC',               color: 'bg-purple-100 text-purple-700',     dot: 'bg-purple-500' },
  Polish:         { label: 'Polish',           color: 'bg-pink-100 text-pink-700',         dot: 'bg-pink-500' },
  Packaging:      { label: 'Packaging',        color: 'bg-teal-100 text-teal-700',         dot: 'bg-teal-500' },
  'Ready to Ship':{ label: 'Ready to Ship',    color: 'bg-emerald-100 text-emerald-700',   dot: 'bg-emerald-500' },
  Shipped:        { label: 'Shipped',          color: 'bg-indigo-100 text-indigo-700',     dot: 'bg-indigo-500' },
  Completed:      { label: 'Completed',        color: 'bg-green-100 text-green-700',       dot: 'bg-green-500' },
  Cancelled:      { label: 'Cancelled',        color: 'bg-red-100 text-red-600',           dot: 'bg-red-400' },
};

export const CUSTOMER_STATUS_CONFIG = {
  Active:   { label: 'Active',   color: 'bg-green-100 text-green-700' },
  Inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-500'   },
};

// ─── Order type badge colors ──────────────────────────────────────────────────
export const ORDER_TYPE_CONFIG = {
  'Sample Order':  { color: 'bg-orange-100 text-orange-700' },
  'Regular Order': { color: 'bg-brand-100 text-brand-700'   },
};

// ─── Country abbreviation (formerly emoji flag) ───────────────────────────────
export const getCountryFlag = (country) => {
  if (!country) return '';
  const abbreviations = {
    'United States': 'US', 'United Kingdom': 'UK',
    'South Africa': 'ZA', 'New Zealand': 'NZ',
  };
  return abbreviations[country] || country.substring(0, 2).toUpperCase();
};

// ─── Truncate text ────────────────────────────────────────────────────────────
export const truncate = (str, maxLen = 40) => {
  if (!str) return '—';
  return str.length > maxLen ? `${str.substring(0, maxLen)}...` : str;
};

// ─── Media URL resolver ───────────────────────────────────────────────────────
// Normalizes anything the backend / Excel import / legacy data might hand us:
//   • absolute http(s)/data/blob URLs  → returned as-is
//   • Windows backslashes              → forward slashes
//   • relative `uploads/...`            → leading-slashed
//   • leading-slash paths               → prefixed with origin so they work
//                                         inside popup windows that lose the
//                                         dev-proxy context (e.g. window.open)
//
// `opts.absolute = true` forces the full origin prefix even in same-origin
// contexts (needed for popup print windows + ExcelJS image fetches).
export const resolveMediaSrc = (p, opts = {}) => {
  if (!p || typeof p !== 'string') return '';
  const forward = p.replace(/\\/g, '/').trim();
  if (!forward) return '';
  if (/^(https?:|data:|blob:)/i.test(forward)) return forward;
  const path = forward.startsWith('/') ? forward : `/${forward}`;
  if (!opts.absolute) return path;
  // Only the origin — strip any `/api/v1` suffix from VITE_API_URL or
  // `/uploads` suffix from VITE_UPLOAD_URL.
  const explicit = import.meta.env.VITE_UPLOAD_URL
    ? import.meta.env.VITE_UPLOAD_URL.replace(/\/uploads$/, '')
    : (typeof window !== 'undefined' ? window.location.origin : '');
  return `${explicit}${path}`;
};

// ─── Image error fallback (inline SVG placeholder) ────────────────────────────
// Use as: <img src={url} onError={imgErrorFallback} />. The placeholder is a
// muted "image not found" tile that survives a broken upload without leaving
// the user staring at the browser's default broken-image glyph.
const FALLBACK_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
       <rect width="120" height="120" fill="#f4eadc"/>
       <path d="M20 90 L50 60 L70 78 L90 56 L100 66 L100 100 L20 100 Z" fill="#e0c79c"/>
       <circle cx="42" cy="42" r="10" fill="#e0c79c"/>
       <text x="60" y="116" text-anchor="middle" font-family="Segoe UI,Arial" font-size="9" fill="#a86820">No image</text>
     </svg>`
  );
export const imgErrorFallback = (e) => {
  if (e?.currentTarget && e.currentTarget.src !== FALLBACK_DATA_URL) {
    e.currentTarget.src = FALLBACK_DATA_URL;
    e.currentTarget.style.objectFit = 'contain';
  }
};
