// Shared helpers for the showroom's L × W × H dimensions, which use the same
// shape as Order.items[].dimensions ({ length, width, height, unit }).

export const EMPTY_DIMENSIONS = { length: '', width: '', height: '', unit: 'cm' };

export const hasDimensions = (d) =>
  !!d && (Number(d.length) > 0 || Number(d.width) > 0 || Number(d.height) > 0);

// "120 × 45 × 90 cm" for display / Excel.
export const formatDimensions = (d) => {
  if (!hasDimensions(d)) return '';
  const n = (v) => Number(v) || 0;
  return `${n(d.length)} × ${n(d.width)} × ${n(d.height)} ${d.unit || 'cm'}`;
};

// Legacy products only have the free-text `size` string. Pull the first three
// numbers out of it so they still map onto real dimensions. Returns null when
// fewer than three numbers are present.
export const parseSizeString = (size) => {
  if (!size) return null;
  const nums = String(size).match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 3) return null;
  const unit = /inch|inches|\bin\b|"|''/i.test(size) ? 'inch' : 'cm';
  const [length, width, height] = nums.slice(0, 3).map(Number);
  return { length, width, height, unit };
};

// Dimensions of a showroom product, whichever generation it belongs to.
export const productDimensions = (p) =>
  hasDimensions(p?.dimensions) ? p.dimensions : parseSizeString(p?.size);

// What to show in a "Size" column for a showroom product.
export const productSizeLabel = (p) => {
  const d = productDimensions(p);
  return d ? formatDimensions(d) : (p?.size || '');
};
