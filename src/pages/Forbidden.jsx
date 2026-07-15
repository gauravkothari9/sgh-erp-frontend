import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function Forbidden() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
        <ShieldAlert size={32} className="text-rose-500" strokeWidth={1.8} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
      <p className="text-gray-500 mt-2 max-w-sm">
        You don't have permission to view this page. If you think this is a
        mistake, contact an administrator.
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="btn-primary btn mt-6"
      >
        Back to dashboard
      </button>
    </div>
  );
}
