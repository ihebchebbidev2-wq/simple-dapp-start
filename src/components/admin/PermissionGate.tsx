import React from "react";
import { Link } from "react-router-dom";
import { ShieldX, Loader2 } from "lucide-react";
import { usePermissions, AdminPermissions } from "@/hooks/usePermissions";

interface Props {
  permission: keyof AdminPermissions;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user has the required permission.
 * Shows loading spinner while permissions are being fetched.
 * Otherwise shows a 403 Access Denied screen.
 * Must be rendered inside AdminLayout (auth is already verified there).
 */
export function PermissionGate({ permission, children }: Props) {
  const { canAccess, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccess(permission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-10 w-10 text-destructive/60" />
        </div>
        <div>
          <h2 className="font-display font-black text-2xl mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            You don't have permission to view this page. Contact your administrator
            to request access.
          </p>
        </div>
        <Link to="/admin" className="admin-btn--secondary text-sm">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
