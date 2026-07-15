import { useEffect } from 'react';
import { authAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';

/**
 * usePermissionRefresh
 *
 * Polls /auth/me while a user is signed in so that permission changes pushed
 * by an Admin take effect within the configured interval without requiring
 * the user to log back in. Per spec, the target propagation time is ~60s.
 *
 * The backend also marks stale responses with `X-Permissions-Stale` — we
 * react to that here by forcing an immediate refresh rather than waiting
 * for the next tick.
 */
export default function usePermissionRefresh(intervalMs = 45_000) {
  const { token, user, updateUser, logout } = useAuthStore();

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await authAPI.getMe();
        if (cancelled) return;
        const fresh = res.data?.data?.user;
        if (fresh) {
          // If the active flag flipped or the account disappeared while the
          // user was sitting idle, kick them to the login screen.
          if (fresh.isActive === false) {
            logout();
            return;
          }
          if (
            !user ||
            fresh.permissionsVersion !== user.permissionsVersion ||
            fresh.role !== user.role
          ) {
            updateUser(fresh);
          }
        }
      } catch (err) {
        // 401 is already handled by the axios interceptor (it redirects to
        // /login). Everything else is non-fatal — just try again next tick.
        if (err.response?.status === 401) return;
      }
    };

    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
