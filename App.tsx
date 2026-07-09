import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Suspense, lazy } from 'react';

// Eager load core pages
import Index from './pages/Index';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';

// Lazy load other pages to prevent import errors from crashing the whole app
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Orders = lazy(() => import('./pages/Orders'));
const Bookings = lazy(() => import('./pages/Bookings'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminAwos = lazy(() => import('./pages/AdminAwos'));
const AdminClients = lazy(() => import('./pages/AdminClients'));
const AdminConsultations = lazy(() => import('./pages/AdminConsultations'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const AdminHousesBotanica = lazy(() => import('./pages/AdminHousesBotanica'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const SuperAdminSetup = lazy(() => import('./pages/SuperAdminSetup'));
const SystemTestAccounts = lazy(() => import('./pages/SystemTestAccounts'));
const AwoDashboard = lazy(() => import('./pages/AwoDashboard'));
const AwoConsultations = lazy(() => import('./pages/AwoConsultations'));
const ConsultationWorkspace = lazy(() => import('./pages/ConsultationWorkspace'));
const ConsultationHistory = lazy(() => import('./pages/ConsultationHistory'));
const AwoScheduling = lazy(() => import('./pages/AwoScheduling'));
const AwoClients = lazy(() => import('./pages/AwoClients'));
const AwoPayments = lazy(() => import('./pages/AwoPayments'));
const AwoMessages = lazy(() => import('./pages/AwoMessages'));
const HouseDashboard = lazy(() => import('./pages/HouseDashboard'));
const ClientAuth = lazy(() => import('./pages/ClientAuth'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ClientAuthCallback = lazy(() => import('./pages/ClientAuthCallback'));
const ClientBookings = lazy(() => import('./pages/ClientBookings'));
const ClientPayments = lazy(() => import('./pages/ClientPayments'));
const ClientMessages = lazy(() => import('./pages/ClientMessages'));
const ClientProfilePage = lazy(() => import('./pages/ClientProfile'));
const ClientConsultations = lazy(() => import('./pages/ClientConsultations'));
const ClientBotanica = lazy(() => import('./pages/ClientBotanica'));

// Layouts (eager load for wrapping)
import { ClientLayout } from './components/ClientLayout';
import { AdminLayout } from './components/AdminLayout';
import { AwoLayout } from './components/AwoLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/bookings" element={<Bookings />} />
      <Route path="/seller/dashboard" element={<SellerDashboard />} />

      {/* Awo Portal - Nested routes with shared layout */}
      <Route path="/awo" element={<AwoLayout />}>
        <Route path="dashboard" element={<AwoDashboard />} />
        <Route path="consultations" element={<AwoConsultations />} />
        <Route path="schedule" element={<AwoScheduling />} />
        <Route path="clients" element={<AwoClients />} />
        <Route path="messages" element={<AwoMessages />} />
        <Route path="payments" element={<AwoPayments />} />
        <Route path="house" element={<HouseDashboard />} />
        <Route path="history" element={<ConsultationHistory />} />
        <Route index element={<Navigate to="/awo/dashboard" replace />} />
      </Route>

      {/* Consultation workspace (shared between awo and client) */}
      <Route path="/consultation/:id" element={<ConsultationWorkspace />} />

      {/* Client Portal - Auth routes outside layout */}
      <Route path="/client/auth" element={<ClientAuth />} />
      <Route path="/client/auth/callback" element={<ClientAuthCallback />} />

      {/* Client Portal - Nested routes with shared layout */}
      <Route path="/client" element={<ClientLayout />}>
        <Route path="dashboard" element={<ClientDashboard />} />
        <Route path="bookings" element={<ClientBookings />} />
        <Route path="payments" element={<ClientPayments />} />
        <Route path="messages" element={<ClientMessages />} />
        <Route path="profile" element={<ClientProfilePage />} />
        <Route path="consultations" element={<ClientConsultations />} />
        <Route path="consultations/:id" element={<ClientConsultations />} />
        <Route path="botanica" element={<ClientBotanica />} />
        <Route index element={<Navigate to="/client/dashboard" replace />} />
      </Route>

      {/* Admin Portal - Nested routes with shared layout */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="awos" element={<AdminAwos />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="consultations" element={<AdminConsultations />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="houses" element={<AdminHousesBotanica />} />
        <Route path="botanica" element={<AdminHousesBotanica />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      {/* Legacy admin route */}
      <Route path="/admin-legacy" element={<Admin />} />

      {/* Auth routes */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/error" element={<AuthError />} />

      {/* System routes */}
      <Route path="/setup/super-admin" element={<SuperAdminSetup />} />
      <Route path="/system/test-accounts" element={<SystemTestAccounts />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
export { AppRoutes };