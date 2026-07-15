import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { notificationAPI } from '../utils/api';
import { timeAgo } from '../utils/formatters';
import { notificationMeta, NOTIFICATION_GROUPS } from '../utils/notificationMeta';

// Full notification history. The bell shows the latest few; this is everything,
// filterable by area. A user only ever receives notifications for the modules
// they hold — Admins receive every event on the platform.
export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.list({ limit: 100 });
      setItems(res.data?.data?.notifications || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (n) => {
    if (!n.isRead) {
      try { await notificationAPI.markRead(n._id); } catch { /* ignore */ }
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try { await notificationAPI.markAllRead(); } catch { /* ignore */ }
    setItems((list) => list.map((x) => ({ ...x, isRead: true })));
  };

  const activeTypes = NOTIFICATION_GROUPS.find((g) => g.key === group)?.types || [];
  const visible = items
    .filter((n) => (activeTypes.length ? activeTypes.includes(n.type) : true))
    .filter((n) => (unreadOnly ? !n.isRead : true));

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <Bell size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">
              {items.length} total{unread > 0 ? ` · ${unread} unread` : ' · all read'}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="btn btn-secondary">
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {NOTIFICATION_GROUPS.map((g) => (
          <button
            key={g.key || 'all'}
            onClick={() => setGroup(g.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              group === g.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-linen-300 hover:border-brand-300'
            }`}
          >
            {g.label}
          </button>
        ))}
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            unreadOnly ? 'bg-terracotta-500 text-white border-terracotta-500' : 'bg-white text-gray-600 border-linen-300 hover:border-brand-300'
          }`}
        >
          Unread only
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">
          Nothing here.
        </div>
      ) : (
        <div className="bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden divide-y divide-linen-200">
          {visible.map((n) => {
            const { icon: Icon, tone } = notificationMeta(n.type);
            return (
              <button
                key={n._id}
                onClick={() => open(n)}
                className={`w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors flex gap-3 ${n.isRead ? '' : 'bg-brand-50/40'}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>{n.title}</p>
                  <p className="text-xs text-gray-500">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && <span className="w-2 h-2 bg-terracotta-500 rounded-full shrink-0 mt-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
