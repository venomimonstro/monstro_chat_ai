import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { AppLayout } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TwoFaPage } from './pages/TwoFaPage';
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
              <Route path="/sources" element={<SourcesPage />} />
              <Route path="/sources/:id" element={<SourceSettingsPage />} />
              <Route path="/chats" element={<PlaceholderPage title="Чаты" />} />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/billing/success" element={<BillingSuccessPage />} />
              <Route path="/billing/failed" element={<BillingFailedPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/team" element={<TeamPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-500">Раздел будет реализован в следующих спринтах.</p>
    </div>
  );
}
