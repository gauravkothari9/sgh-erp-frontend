import { Construction } from 'lucide-react';

/**
 * Placeholder shown for modules whose Admin-assignable permission exists but
 * whose dedicated UI hasn't been built yet. Each of these routes still
 * enforces the `moduleKey` permission via PermissionGate in App.jsx, so
 * Admins can grant read/create/update/delete to employees today and the real
 * feature can replace this placeholder later without touching routing or
 * permissions.
 */
export default function ModulePlaceholder({ title, description, icon: Icon = Construction }) {
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{description}</p>
        </div>
      </div>

      <div className="bg-white border border-brand-100 rounded-xl p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-50 mx-auto flex items-center justify-center text-brand-500 mb-4">
          <Icon size={28} strokeWidth={1.6} />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">{title} module coming soon</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Permissions for this module are already wired — Admins can grant
          create, read, update and delete access to employees. The full feature
          UI will land here in an upcoming release.
        </p>
      </div>
    </div>
  );
}
