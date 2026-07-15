import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Cross-folder product selection. Persisted to localStorage so a user can
// open another Buyer File, keep adding products, refresh the page mid-flow,
// then hit "Create Order with Selected" and have everything carry over.
//
// Shape: items[productId] = { product, fileNumber, buyerName }
// We store the full product snapshot so CreateOrder.jsx can hydrate the
// draft line-items without re-fetching.
export const useCatalogueSelectionStore = create(
  persist(
    (set, get) => ({
      items: {},

      toggle: (product, fileNumber, buyerName) =>
        set((state) => {
          const id = product?._id;
          if (!id) return state;
          const next = { ...state.items };
          if (next[id]) delete next[id];
          else next[id] = { product, fileNumber: fileNumber || '', buyerName: buyerName || '' };
          return { items: next };
        }),

      add: (product, fileNumber, buyerName) =>
        set((state) => {
          const id = product?._id;
          if (!id) return state;
          return {
            items: {
              ...state.items,
              [id]: { product, fileNumber: fileNumber || '', buyerName: buyerName || '' },
            },
          };
        }),

      remove: (productId) =>
        set((state) => {
          if (!productId || !state.items[productId]) return state;
          const next = { ...state.items };
          delete next[productId];
          return { items: next };
        }),

      clear: () => set({ items: {} }),
    }),
    {
      name: 'sgh-erp-catalogue-selection',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Convenience selectors (kept outside the store body so consumers can pick
// the slice they want and avoid re-renders on unrelated changes).
export const selectCount = (state) => Object.keys(state.items).length;
export const selectHas = (id) => (state) => !!state.items[id];
export const selectAllProducts = (state) =>
  Object.values(state.items).map((e) => e.product);

// Group selected products by their originating file number so the action
// bar / order draft can show "from File X (Buyer A), File Y (Buyer B)".
export const selectGroupedByFile = (state) => {
  const groups = {};
  Object.values(state.items).forEach((entry) => {
    const key = entry.fileNumber || '—';
    if (!groups[key]) {
      groups[key] = {
        fileNumber: entry.fileNumber || '',
        buyerName: entry.buyerName || '',
        items: [],
      };
    }
    groups[key].items.push(entry.product);
  });
  return Object.values(groups);
};
