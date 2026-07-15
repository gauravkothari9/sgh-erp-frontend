import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Store, Users } from 'lucide-react';
import { locationsApi } from '../lib/endpoints';

export default function LocationAdminPage() {
  const { data } = useQuery({
    queryKey: ['v2', 'locations'],
    queryFn: () => locationsApi.list().then((r) => r.data.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-ink">Locations</h1>
        <Link to="/v2/admin/users" className="text-xs flex items-center gap-1 text-brand-inkMuted hover:text-brand-primary">
          <Users size={12} /> Users
        </Link>
      </div>

      <div className="space-y-4">
        {(data?.hierarchy || []).map((p) => (
          <div key={p.id} className="bg-brand-surface border border-brand-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <Store size={16} />
              </div>
              <div>
                <p className="font-bold text-brand-ink">{p.name}</p>
                <p className="text-[11px] font-mono text-brand-inkMuted">{p.code}</p>
              </div>
            </div>
            <ul className="ml-12 space-y-1">
              {p.children.map((c) => (
                <li key={c.id} className="text-sm flex items-center justify-between border-b border-brand-border py-1">
                  <span>{c.name} <span className="font-mono text-xs text-brand-inkMuted">({c.code})</span></span>
                  <Link to={`/v2/showrooms/${c.id}`} className="text-xs text-brand-primary font-semibold">Open</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
