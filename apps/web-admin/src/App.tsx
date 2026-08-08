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
import { SprintsPage } from './pages/SprintsPage';
import { BackupsPage } from './pages/BackupsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TariffsPage } from './pages/TariffsPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { SiteSettingsLayout } from './components/SiteSettingsLayout';
import { SiteSettingsPage } from './pages/SiteSettingsPage';
import { SiteCodePage } from './pages/SiteCodePage';
import { SiteDiagnosticsPage } from './pages/SiteDiagnosticsPage';
import { StabilityPage } from './pages/StabilityPage';
import { PlatformPromptPage } from './pages/PlatformPromptPage';

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
              <Route path="/platform-prompt" element={<PlatformPromptPage />} />
              <Route path="/site-settings" element={<SiteSettingsLayout />}>
                <Route index element={<SiteSettingsPage />} />
                <Route path="code" element={<SiteCodePage />} />
                <Route path="diagnostics" element={<SiteDiagnosticsPage />} />
              </Route>
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/updates" element={<UpdatesPage />} />
              <Route path="/sprints" element={<SprintsPage />} />
              <Route path="/stability" element={<StabilityPage />} />
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
