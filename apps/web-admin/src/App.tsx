import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { AuthProvider } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsPage } from './pages/TenantsPage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { BackupsPage } from './pages/BackupsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TariffsPage } from './pages/TariffsPage';
import { ProvidersPage } from './pages/ProvidersPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastContainer />
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tenants" element={<TenantsPage />} />
              <Route path="/tenants/:id" element={<TenantDetailPage />} />
              <Route path="/tariffs" element={<TariffsPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/updates" element={<UpdatesPage />} />
              <Route path="/backups" element={<BackupsPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
