import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RemquipLoadingScreen } from '@/components/RemquipLoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'super_admin' | 'manager' | 'user';
  requiredPermission?: string;
  fallbackPath?: string;
}

/**
 * ProtectedRoute Component
 * Restricts access to routes based on user authentication and role
 * 
 * Usage:
 * <ProtectedRoute requiredRole="admin">
 *   <AdminPage />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({
  children,
  requiredRole = 'admin',
  requiredPermission,
  fallbackPath = '/login',
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] Checking access - User:', user?.email, 'Role:', user?.role, 'Required:', requiredRole);

  // Loading state
  if (isLoading) {
    return <RemquipLoadingScreen variant="fullscreen" message="Verifying access" />;
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    console.warn('[ProtectedRoute] Access denied: Not authenticated');
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check role authorization
  const isAuthorized = checkRoleAuthorization(user.role, requiredRole);
  if (!isAuthorized) {
    console.warn('[ProtectedRoute] Access denied: Insufficient role. User has', user.role, 'but requires', requiredRole);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-foreground/75 mb-6">
            You do not have the required permissions to access this page. Contact your administrator if you believe this is an error.
          </p>
          <a href="/" className="inline-block bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-2 rounded-lg font-semibold transition-colors">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  // TODO: Check granular permissions when implemented
  // if (requiredPermission && !user.permissions?.[requiredPermission]) {
  //   console.warn('[ProtectedRoute] Access denied: Missing permission:', requiredPermission);
  //   return <Navigate to="/" state={{ from: location }} replace />;
  // }

  console.log('[ProtectedRoute] Access granted for:', user.email);
  return <>{children}</>;
}

/**
 * Check if user role has required authorization level
 * Higher roles can access lower-level content
 */
function checkRoleAuthorization(userRole: string, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    'super_admin': 4,
    'admin': 3,
    'manager': 2,
    'user': 1,
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Utility function to check if user can access a resource
 */
export function useCanAccess(requiredRole?: string): boolean {
  const { user } = useAuth();

  if (!user || !requiredRole) return false;

  return checkRoleAuthorization(user.role, requiredRole);
}
