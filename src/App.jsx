import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import usePermissionRefresh from './hooks/usePermissionRefresh';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CreateCustomer from './pages/CreateCustomer';
import CustomerDetail from './pages/CustomerDetail';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import CreateOrder from './pages/CreateOrder';
import CustomerOrders from './pages/CustomerOrders';
import OrderGallery from './pages/OrderGallery';
import Invoice from './pages/Invoice';
import BuyerCatalogueFolders from './pages/BuyerCatalogue/BuyerCatalogueFolders';
import BuyerCatalogueDetail from './pages/BuyerCatalogue/BuyerCatalogueDetail';
import BuyerCatalogueProduct from './pages/BuyerCatalogue/BuyerCatalogueProduct';
import ProductionBoard from './pages/Production/ProductionBoard';
import Users from './pages/Users/Users';
import CreateUser from './pages/Users/CreateUser';
import EditUser from './pages/Users/EditUser';
import UserPermissions from './pages/Users/UserPermissions';
import ModulePlaceholder from './pages/ModulePlaceholder';
import JhalamandOrders from './pages/JhalamandOrders';
import JhalamandInTransit from './pages/branches/JhalamandInTransit';
import KakaniOrders from './pages/branches/KakaniOrders';
import KakaniInTransit from './pages/branches/KakaniInTransit';
import KakaniRepairing from './pages/branches/KakaniRepairing';
import KakaniPolish from './pages/branches/KakaniPolish';
import KakaniQC from './pages/branches/KakaniQC';
import KakaniPacking from './pages/branches/KakaniPacking';
import KakaniIronKhata from './pages/branches/KakaniIronKhata';
import Outsourced from './pages/Outsourced';
import Container from './pages/Container';
import ShowroomBranch from './pages/Showroom/ShowroomBranch';
import ShowroomZone from './pages/Showroom/ShowroomZone';
import ShowroomCollections from './pages/Showroom/ShowroomCollections';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import InstallPrompt from './components/common/InstallPrompt';
import LocalCustomers from './pages/Local/LocalCustomers';
import LocalCustomerDetail from './pages/Local/LocalCustomerDetail';
import LocalSales from './pages/Local/LocalSales';
import LocalSaleDetail from './pages/Local/LocalSaleDetail';
import CreateLocalSale from './pages/Local/CreateLocalSale';
import V2App from './v2/App';
import Forbidden from './pages/Forbidden';
import NotFound from './pages/NotFound';
import {
  Settings as SettingsIcon,
  Wrench,
  Sparkles,
  Package,
  ShoppingBag,
  Truck,
  ClipboardCheck,
  Share2,
  Container as ContainerIcon,
  Store,
} from 'lucide-react';

// Basic auth gate — just checks for a token.
const ProtectedRoute = ({ children }) => {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// Permission gate — renders children only if the user has the required
// module/action permission, otherwise routes to /forbidden.
// `anyOf` lets a page that spans several modules (e.g. showroom collections,
// which covers both branches) open for a user who has any one of them.
const PermissionGate = ({ moduleKey, action = 'read', anyOf, children }) => {
  const can = useAuthStore((s) => s.can);
  const allowed = anyOf?.length
    ? anyOf.some((key) => can(key, action))
    : can(moduleKey, action);
  if (!allowed) {
    return <Navigate to="/forbidden" replace />;
  }
  return children;
};

// Redirect authenticated users away from /login.
const PublicRoute = ({ children }) => {
  const { token } = useAuthStore();
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  // Keep cached permissions in sync with the server while the user is
  // signed in. Silent no-op when there's no token.
  usePermissionRefresh();

  return (
    <>
    <InstallPrompt />
    <Routes>
      {/* v2 — MongoDB-backed Showroom Inventory module. Has its own auth +
          shell so it does not interfere with the legacy v1 routes below. */}
      <Route path="/v2/*" element={<V2App />} />

      {/* Public */}
      <Route
        path="/login"
        element={<PublicRoute><Login /></PublicRoute>}
      />

      {/* Protected */}
      <Route
        path="/"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="forbidden" element={<Forbidden />} />

        {/* Customer Module */}
        <Route
          path="office/customers"
          element={<PermissionGate moduleKey="customers"><Customers /></PermissionGate>}
        />
        <Route
          path="office/customers/new"
          element={<PermissionGate moduleKey="customers" action="create"><CreateCustomer /></PermissionGate>}
        />
        <Route
          path="office/customers/:id"
          element={<PermissionGate moduleKey="customers"><CustomerDetail /></PermissionGate>}
        />
        <Route
          path="office/customers/:id/edit"
          element={<PermissionGate moduleKey="customers" action="update"><CreateCustomer /></PermissionGate>}
        />

        {/* Order Module */}
        <Route
          path="office/orders"
          element={<PermissionGate moduleKey="orders"><Orders /></PermissionGate>}
        />
        <Route
          path="office/orders/folder"
          element={<PermissionGate moduleKey="orders"><CustomerOrders /></PermissionGate>}
        />
        <Route
          path="office/orders/:id/photos"
          element={<PermissionGate moduleKey="orders"><OrderGallery /></PermissionGate>}
        />
        <Route
          path="office/orders/new"
          element={<PermissionGate moduleKey="orders" action="create"><CreateOrder /></PermissionGate>}
        />
        <Route
          path="office/orders/:id"
          element={<PermissionGate moduleKey="orders"><OrderDetail /></PermissionGate>}
        />
        <Route
          path="office/orders/:id/edit"
          element={<PermissionGate moduleKey="orders" action="update"><CreateOrder /></PermissionGate>}
        />
        {/* Invoice Route */}
        <Route
          path="office/orders/:id/invoice"
          element={<PermissionGate moduleKey="orders"><Invoice /></PermissionGate>}
        />

        {/* Factory: Production Board */}
        <Route
          path="factory/production"
          element={<PermissionGate moduleKey="production"><ProductionBoard /></PermissionGate>}
        />

        {/* Outsourced Module */}
        <Route
          path="outsourced"
          element={<PermissionGate moduleKey="outsourced"><Outsourced /></PermissionGate>}
        />

        {/* Branches: Jhalamand */}
        <Route
          path="branches/jhalamand"
          element={<Navigate to="/branches/jhalamand/orders" replace />}
        />
        <Route
          path="branches/jhalamand/orders"
          element={<PermissionGate moduleKey="jhalamand"><JhalamandOrders /></PermissionGate>}
        />
        <Route
          path="branches/jhalamand/in-transit"
          element={<PermissionGate moduleKey="jhalamand"><JhalamandInTransit /></PermissionGate>}
        />

        {/* Branches: Kakani */}
        <Route
          path="branches/kakani"
          element={<Navigate to="/branches/kakani/orders" replace />}
        />
        <Route
          path="branches/kakani/orders"
          element={<PermissionGate moduleKey="kakani"><KakaniOrders /></PermissionGate>}
        />
        <Route
          path="branches/kakani/orders-in-transit"
          element={<PermissionGate moduleKey="kakani"><KakaniInTransit /></PermissionGate>}
        />
        <Route
          path="branches/kakani/repairing"
          element={<PermissionGate moduleKey="kakani"><KakaniRepairing /></PermissionGate>}
        />
        <Route
          path="branches/kakani/polish"
          element={<PermissionGate moduleKey="kakani"><KakaniPolish /></PermissionGate>}
        />
        <Route
          path="branches/kakani/qc"
          element={<PermissionGate moduleKey="kakani"><KakaniQC /></PermissionGate>}
        />
        <Route
          path="branches/kakani/packing"
          element={<PermissionGate moduleKey="kakani"><KakaniPacking /></PermissionGate>}
        />
        <Route
          path="branches/kakani/iron-khata"
          element={<PermissionGate moduleKey="kakani"><KakaniIronKhata /></PermissionGate>}
        />

        {/* Buyer Catalogue Module */}
        <Route
          path="office/buyer-catalogue"
          element={<PermissionGate moduleKey="buyerCatalogue"><BuyerCatalogueFolders /></PermissionGate>}
        />
        <Route
          path="office/buyer-catalogue/:fileNumber"
          element={<PermissionGate moduleKey="buyerCatalogue"><BuyerCatalogueDetail /></PermissionGate>}
        />
        <Route
          path="office/buyer-catalogue/:fileNumber/product/:sku"
          element={<PermissionGate moduleKey="buyerCatalogue"><BuyerCatalogueProduct /></PermissionGate>}
        />



        {/* Container Module */}
        <Route
          path="office/container"
          element={<PermissionGate moduleKey="container"><Container /></PermissionGate>}
        />

        {/* Notifications — personal, no module gate */}
        <Route path="notifications" element={<Notifications />} />

        {/* Showroom — collections across both branches */}
        <Route
          path="showroom/collections"
          element={<PermissionGate moduleKey="showroomKakani" anyOf={['showroomKakani', 'showroomJhalamand']}><ShowroomCollections /></PermissionGate>}
        />

        {/* Showroom — branch landings (list zones) */}
        <Route
          path="showroom/kakani"
          element={<PermissionGate moduleKey="showroomKakani"><ShowroomBranch branch="Kakani" zones={['A', 'B', 'C']} /></PermissionGate>}
        />
        <Route
          path="showroom/jhalamand"
          element={<PermissionGate moduleKey="showroomJhalamand"><ShowroomBranch branch="Jhalamand" zones={['A', 'B', 'C', 'D']} /></PermissionGate>}
        />

        {/* Showroom — Kakani (3 zones) & Jhalamand (4 zones) */}
        {['a', 'b', 'c'].map((z) => (
          <Route
            key={`sk-${z}`}
            path={`showroom/kakani/zone-${z}`}
            element={<PermissionGate moduleKey="showroomKakani"><ShowroomZone branch="Kakani" zone={z.toUpperCase()} /></PermissionGate>}
          />
        ))}
        {['a', 'b', 'c', 'd'].map((z) => (
          <Route
            key={`sj-${z}`}
            path={`showroom/jhalamand/zone-${z}`}
            element={<PermissionGate moduleKey="showroomJhalamand"><ShowroomZone branch="Jhalamand" zone={z.toUpperCase()} /></PermissionGate>}
          />
        ))}

        {/* Local — walk-in customers & showroom-floor orders */}
        <Route
          path="local/customers"
          element={<PermissionGate moduleKey="localCustomers"><LocalCustomers /></PermissionGate>}
        />
        <Route
          path="local/customers/:id"
          element={<PermissionGate moduleKey="localCustomers"><LocalCustomerDetail /></PermissionGate>}
        />
        <Route
          path="local/orders"
          element={<PermissionGate moduleKey="localSales"><LocalSales /></PermissionGate>}
        />
        <Route
          path="local/orders/new"
          element={<PermissionGate moduleKey="localSales"><CreateLocalSale /></PermissionGate>}
        />
        <Route
          path="local/orders/:id"
          element={<PermissionGate moduleKey="localSales"><LocalSaleDetail /></PermissionGate>}
        />

        {/* Profile — personal, no module gate */}
        <Route path="profile" element={<Profile />} />

        {/* System Settings — viewable by holders of `settings`, editable with update */}
        <Route
          path="admin/settings"
          element={<PermissionGate moduleKey="settings"><Settings /></PermissionGate>}
        />

        {/* Admin: User Management */}
        <Route
          path="admin/users"
          element={<PermissionGate moduleKey="users"><Users /></PermissionGate>}
        />
        <Route
          path="admin/users/create"
          element={<PermissionGate moduleKey="users" action="create"><CreateUser /></PermissionGate>}
        />
        <Route
          path="admin/users/:id/edit"
          element={<PermissionGate moduleKey="users" action="update"><EditUser /></PermissionGate>}
        />
        <Route
          path="admin/users/:id/permissions"
          element={<PermissionGate moduleKey="users" action="update"><UserPermissions /></PermissionGate>}
        />

      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
}
