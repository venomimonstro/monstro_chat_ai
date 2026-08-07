import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-slate-500">
      <div className="max-w-sm space-y-2 text-center">
        <p>Загрузка...</p>
        <p className="text-xs text-slate-400">
          Если экран не меняется — API недоступен или сессия зависла. Обновите страницу.
        </p>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
