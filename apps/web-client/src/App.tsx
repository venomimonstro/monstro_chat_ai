import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { AppLayout } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { PermissionRoute } from './components/PermissionRoute';
import { PERMISSIONS } from './lib/permissions';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TwoFaPage } from './pages/TwoFaPage';
import { ChatsPage } from './pages/ChatsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SourcesPage } from './pages/SourcesPage';
import { SourceSettingsPage } from './pages/SourceSettingsPage';
import { CrmPage } from './pages/CrmPage';
import { BillingPage } from './pages/BillingPage';
import { BillingSuccessPage } from './pages/BillingSuccessPage';
import { BillingFailedPage } from './pages/BillingFailedPage';
import { ImpersonatePage } from './pages/ImpersonatePage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { TeamPage } from './pages/TeamPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastContainer />
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route path="/2fa" element={<TwoFaPage />} />
          <Route path="/impersonate" element={<ImpersonatePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route
                path="/sources"
                element={
                  <PermissionRoute permission={PERMISSIONS.SOURCES_MANAGE}>
                    <SourcesPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/sources/:id"
                element={
                  <PermissionRoute permission={PERMISSIONS.SOURCES_MANAGE}>
                    <SourceSettingsPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/chats"
                element={
                  <PermissionRoute permission={PERMISSIONS.CHATS_VIEW}>
                    <ChatsPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/crm"
                element={
                  <PermissionRoute permission={PERMISSIONS.CRM_LEADS_VIEW}>
                    <CrmPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/billing"
                element={
                  <PermissionRoute permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <BillingPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/billing/success"
                element={
                  <PermissionRoute permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <BillingSuccessPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/billing/failed"
                element={
                  <PermissionRoute permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <BillingFailedPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/integrations"
                element={
                  <PermissionRoute permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <IntegrationsPage />
                  </PermissionRoute>
                }
              />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route
                path="/settings"
                element={
                  <PermissionRoute permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <SettingsPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="/team"
                element={
                  <PermissionRoute permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <TeamPage />
                  </PermissionRoute>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}

