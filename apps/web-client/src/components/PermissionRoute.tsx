import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { hasPermission } from '../lib/permissions';

export function PermissionRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!hasPermission(user, permission)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
