import toast from 'react-hot-toast';

// Build a friendly toast from a `validate()`-style errors map. The values
// of the errors map are expected to be user-facing strings already (e.g.
// "Company name is required", "Email is invalid"). This helper turns
// them into a single toast that names the failing fields instead of the
// vague "please fix errors" message we used to show.
//
// Usage:
//   const errs = validate();
//   if (Object.keys(errs).length) { showValidationErrors(errs); return; }
//
// Behaviour:
//   - 1 error  → "Order date is required"
//   - 2 errors → "Customer; Quantity (Item #2)"  (joined with " · ")
//   - 3+       → first 4 errors, then "+N more"
export function showValidationErrors(errors, opts = {}) {
  const values = Object.values(errors || {}).filter(Boolean);
  if (values.length === 0) return;

  const MAX = opts.max ?? 4;
  const shown = values.slice(0, MAX);
  const extra = values.length - shown.length;
  const body = shown.join('  ·  ') + (extra > 0 ? `  ·  +${extra} more` : '');

  toast.error(body, { duration: opts.duration ?? 5000 });
}
