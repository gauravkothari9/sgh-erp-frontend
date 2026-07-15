import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-brand-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Page Not Found</h1>
        <p className="text-gray-500 text-sm mb-6">The page you're looking for doesn't exist.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary btn">
            <ArrowLeft size={15} /> Go Back
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-primary btn">
            <Home size={15} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
