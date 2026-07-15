import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { disconnectSocket } from '../utils/socket';

// Shape of `user.permissions` coming from the backend:
//   { [moduleKey]: { create, read, update, delete } }
// Admins get all-true in every module synthetically.
//
// Relevant user fields:
//   userId, fullName, email, role, designation, department, permissions

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      selectedFactory: 'jhalamand',
      isLoading: false,

      setAuth: (user, token) => {
        const factory = user?.role === 'Admin' ? 'overall' : (user?.factory || 'jhalamand');
        set({ user, token, selectedFactory: factory });
      },

      logout: () => {
        disconnectSocket(); // drop the realtime channel with the session
        set({ user: null, token: null, selectedFactory: 'jhalamand' });
        localStorage.removeItem('sgh-erp-auth');
      },

      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),

      // ─── Role helpers ──────────────────────────────────────────────────
      isAdmin: () => get().user?.role === 'Admin',
      isEmployee: () => get().user?.role === 'Employee',
      // Legacy compatibility — the old role model had "Office Staff". Any
      // caller still reading this helper gets a safe boolean derived from
      // the new permissions model.
      isOfficeStaff: () =>
        get().user?.role === 'Admin' || !!get().user?.permissions?.customers?.read,

      // ─── Permission helper ─────────────────────────────────────────────
      // can(moduleKey, action?) — if action is omitted, returns true when
      // the user has ANY action on the module (useful for nav visibility).
      can: (moduleKey, action) => {
        const u = get().user;
        if (!u) return false;
        if (u.role === 'Admin') return true;
        const modulePerms = u.permissions?.[moduleKey];
        if (!modulePerms) return false;
        if (!action) return Object.values(modulePerms).some(Boolean);
        return !!modulePerms[action];
      },
    }),
    {
      name: 'sgh-erp-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        selectedFactory: state.selectedFactory,
      }),
    }
  )
);

// Bare function form — handy inside utilities/components where you don't
// want to re-render on auth state changes.
export const can = (moduleKey, action) =>
  useAuthStore.getState().can(moduleKey, action);
