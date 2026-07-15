import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthV2 = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setTokens: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user: user ?? get().user }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
      isAdmin: () => get().user?.role === 'ADMIN',
      can: (...roles) => {
        const u = get().user;
        if (!u) return false;
        if (u.role === 'ADMIN') return true;
        return roles.includes(u.role);
      },
    }),
    { name: 'sgh-erp-v2-auth' }
  )
);
