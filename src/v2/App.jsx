// v2 application — mounted at /v2/*. MongoDB-backed Showroom Inventory module.

import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuthV2 } from './stores/authStore';

import V2Shell from './shell/V2Shell';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import FloorViewPage from './pages/FloorView';
import PieceDetailPage from './pages/PieceDetail';
import AddPiecePage from './pages/AddPiece';
import TransferPage from './pages/Transfer';
import QRScannerPage from './pages/QRScanner';
import ReservePage from './pages/Reserve';
import RecordSalePage from './pages/RecordSale';
import CrossSearchPage from './pages/CrossSearch';
import AgingReportPage from './pages/AgingReport';
import SalesReportPage from './pages/SalesReport';
import LocationAdminPage from './pages/LocationAdmin';
import UserAdminPage from './pages/UserAdmin';

const Private = ({ children }) => {
  const accessToken = useAuthV2((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/v2/login" replace />;
  return children;
};

export default function V2App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={
          <Private>
            <V2Shell>
              <Routes>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="showrooms/:locationId" element={<FloorViewPage />} />
                <Route path="pieces" element={<CrossSearchPage />} />
                <Route path="pieces/:id" element={<PieceDetailPage />} />
                <Route path="pieces/new" element={<AddPiecePage />} />
                <Route path="pieces/:id/transfer" element={<TransferPage />} />
                <Route path="pieces/:id/reserve" element={<ReservePage />} />
                <Route path="pieces/:id/sale" element={<RecordSalePage />} />
                <Route path="scan" element={<QRScannerPage />} />
                <Route path="reports/aging" element={<AgingReportPage />} />
                <Route path="reports/sales" element={<SalesReportPage />} />
                <Route path="admin/locations" element={<LocationAdminPage />} />
                <Route path="admin/users" element={<UserAdminPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </V2Shell>
          </Private>
        } />
      </Routes>
    </QueryClientProvider>
  );
}
