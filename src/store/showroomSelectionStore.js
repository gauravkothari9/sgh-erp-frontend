import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Cross-zone showroom product selection. Persisted to localStorage so a user
// can walk every zone (and both branches), keep picking products, refresh
// mid-flow, then export the whole list or turn it into an order.
//
// A selection has a `mode`, chosen when the first item is picked:
//   'local'  → walk-in customer. Prices come from the product's localPrice and
//              the run ends in a local order (bill + stock deduction).
//   'export' → regular buyer. Prices are quoted on the spot, and the run ends
//              in an Excel sheet and/or a draft order in Office → Orders.
//
// Shape: items[productId] = { product, branch, zone, orderQty, price, comments }
// `price` and `comments` are user-entered per selection — they are NOT written
// back to the product; they only live in this draft list until it's turned into
// an order.
export const useShowroomSelectionStore = create(
  persist(
    (set, get) => ({
      items: {},
      mode: null,      // 'local' | 'export'
      customer: null,  // export customer — { _id, companyName, fileNumber, currency }

      setMode: (mode) => set({ mode }),
      setCustomer: (customer) => set({ customer: customer || null }),

      toggle: (product, branch, zone) =>
        set((state) => {
          const id = product?._id;
          if (!id) return state;
          const next = { ...state.items };
          if (next[id]) delete next[id];
          else {
            // Local runs bill the product's stored local price; export runs are
            // quoted on the spot, so the price starts empty. Either way the user
            // can overwrite it in the selection table.
            next[id] = {
              product,
              branch: branch || product.branch || '',
              zone: zone || product.zone || '',
              orderQty: 1,
              price: state.mode === 'local' && product.localPrice ? String(product.localPrice) : '',
              comments: '',
            };
          }
          // Dropping the last item ends the run — the next pick asks again.
          return { items: next, mode: Object.keys(next).length ? state.mode : null };
        }),

      remove: (productId) =>
        set((state) => {
          if (!productId || !state.items[productId]) return state;
          const next = { ...state.items };
          delete next[productId];
          return { items: next, mode: Object.keys(next).length ? state.mode : null };
        }),

      setField: (productId, field, value) =>
        set((state) => {
          const entry = state.items[productId];
          if (!entry) return state;
          return {
            items: { ...state.items, [productId]: { ...entry, [field]: value } },
          };
        }),

      clear: () => set({ items: {}, customer: null, mode: null }),
    }),
    {
      name: 'sgh-erp-showroom-selection',
      partialize: (state) => ({ items: state.items, customer: state.customer, mode: state.mode }),
    }
  )
);

export const selectShowroomCount = (state) => Object.keys(state.items).length;
export const selectShowroomHas = (id) => (state) => !!state.items[id];
// Insertion order is the selection order, which is what the Sr. No. column uses.
export const selectShowroomList = (state) =>
  Object.entries(state.items).map(([id, entry]) => ({ id, ...entry }));
