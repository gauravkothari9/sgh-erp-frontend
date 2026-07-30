import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/formatters';
import { notificationMeta } from '../../utils/notificationMeta';
import { connectSocket, disconnectSocket } from '../../utils/socket';

// Navbar notification bell — polls the server, shows an unread badge, toasts
// anything that lands while you're on-screen, and lets the user open/mark
// notifications. Producers live across the platform (orders, production,
// showroom, local sales, admin); each user only receives what their modules
// cover, and Admins receive everything.
export default function NotificationBell() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const timer = useRef(null);
  const seen = useRef(null); // ids known at the last poll — null until first load

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await notificationAPI.list({ unreadOnly: 1 });
      const list = res.data?.data?.notifications || [];
      setItems(list);
      setUnread(res.data?.data?.unreadCount || 0);

      // Toast whatever arrived since the last poll. The first load only seeds
      // the set — otherwise every unread would toast on page open.
      const ids = new Set(list.map((n) => n._id));
      if (seen.current) {
        list
          .filter((n) => !n.isRead && !seen.current.has(n._id))
          .slice(0, 3)
          .forEach((n) => toast(n.title, { icon: '🔔', duration: 5000 }));
      }
      seen.current = ids;
    } catch {
      /* silent — bell is non-critical */
    }
  }, [token]);

  // Instant delivery over socket.io; the 45s poll is the safety net for anyone
  // whose socket dropped (shop-floor wifi) and for the initial unread count.
  useEffect(() => {
    load();
    timer.current = setInterval(load, 45000);
    return () => clearInterval(timer.current);
  }, [load]);

  useEffect(() => {
    if (!token) { disconnectSocket(); return; }
    const socket = connectSocket(token);
    if (!socket) return;

    const onNotification = (n) => {
      setItems((list) => (list.some((x) => x._id === n._id) ? list : [n, ...list].slice(0, 30)));
      setUnread((u) => u + 1);
      seen.current?.add(n._id); // the poll must not toast it a second time
      toast(n.title, { icon: '🔔', duration: 5000 });
    };

    socket.on('notification', onNotification);
    return () => { socket.off('notification', onNotification); };
  }, [token]);

  const onOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const handleClick = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      try { await notificationAPI.markRead(n._id); } catch { /* ignore */ }
      setUnread((u) => Math.max(0, u - 1));
    }
    // Read notifications leave the bell — they live on in /notifications.
    setItems((list) => list.filter((x) => x._id !== n._id));
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try { await notificationAPI.markAllRead(); } catch { /* ignore */ }
    setUnread(0);
    setItems([]); // bell holds unread only; the history page keeps them all
  };

  return (
    <div className="relative">
      <button
        onClick={onOpen}
        className="relative p-2 rounded-none text-espresso-500 hover:text-espresso-900 transition-colors"
      >
        <Bell size={18} strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[11px] font-bold text-white bg-terracotta-500 rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="fixed left-2 right-2 top-[4.25rem] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] bg-white shadow-card-hover border border-linen-300 z-20 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-linen-200 bg-linen-50">
              <span className="text-sm font-bold text-espresso-900">Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} className="text-[13px] text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">You’re all caught up.</p>
              ) : (
                items.map((n) => {
                  const { icon: Icon, tone } = notificationMeta(n.type);
                  return (
                  <button
                    key={n._id}
                    onClick={() => handleClick(n)}
                    className="w-full text-left px-4 py-3 border-b border-linen-100 hover:bg-brand-50 transition-colors flex gap-3 bg-brand-50/40"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 break-words">{n.title}</p>
                      <p
                        className="text-[13px] text-gray-500 break-words"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {n.message}
                      </p>
                      <p className="text-[12px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    <span className="w-2 h-2 bg-terracotta-500 rounded-full shrink-0 mt-1" />
                  </button>
                  );
                })
              )}
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full px-4 py-2.5 text-[13px] font-semibold text-brand-700 hover:bg-linen-50 border-t border-linen-200"
            >
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  );
}
