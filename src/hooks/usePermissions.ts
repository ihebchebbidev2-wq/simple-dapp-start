import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Admin Permissions Interface
 * Defines what actions an admin user can perform
 */
export interface AdminPermissions {
  canViewDashboard: boolean;
  canManageProducts: boolean;
  canManageOrders: boolean;
  canManageCustomers: boolean;
  canManageInventory: boolean;
  canManageDiscounts: boolean;
  canManageUsers: boolean;
  canManageAnalytics: boolean;
  canManageCMS: boolean;
  canManageTaxRates: boolean;
  canViewAuditLogs: boolean;
  canDeleteData: boolean;
  canEditSettings: boolean;
}

/** All permissions denied */
const EMPTY_PERMISSIONS: AdminPermissions = {
  canViewDashboard: false,
  canManageProducts: false,
  canManageOrders: false,
  canManageCustomers: false,
  canManageInventory: false,
  canManageDiscounts: false,
  canManageUsers: false,
  canManageAnalytics: false,
  canManageCMS: false,
  canManageTaxRates: false,
  canViewAuditLogs: false,
  canDeleteData: false,
  canEditSettings: false,
};

/** All permissions granted (super_admin) */
const FULL_PERMISSIONS: AdminPermissions = {
  canViewDashboard: true,
  canManageProducts: true,
  canManageOrders: true,
  canManageCustomers: true,
  canManageInventory: true,
  canManageDiscounts: true,
  canManageUsers: true,
  canManageAnalytics: true,
  canManageCMS: true,
  canManageTaxRates: true,
  canViewAuditLogs: true,
  canDeleteData: true,
  canEditSettings: true,
};

/**
 * Map page slugs from remquip_pages to AdminPermissions keys.
 * A single page slug can grant multiple permission keys.
 */
const SLUG_TO_PERMISSIONS: Record<string, (keyof AdminPermissions)[]> = {
  dashboard:          ['canViewDashboard'],
  analytics:          ['canManageAnalytics'],
  products:           ['canManageProducts'],
  categories:         ['canManageProducts'],
  inventory:          ['canManageInventory'],
  orders:             ['canManageOrders'],
  offers:             ['canManageOrders'],
  carts:              ['canManageOrders'],
  invoices:           ['canManageOrders'],
  customers:          ['canManageCustomers'],
  'contract-customers': ['canManageCustomers'],
  applications:       ['canManageCustomers'],
  discounts:          ['canManageDiscounts'],
  landing:            ['canManageCMS'],
  cms:                ['canManageCMS'],
  seo:                ['canManageCMS'],
  users:              ['canManageUsers'],
  access:             ['canManageUsers'],
  chat:               ['canViewDashboard'],
  settings:           ['canEditSettings'],
  docs:               ['canViewDashboard'],
  'tax-rates':        ['canManageTaxRates'],
  audit:              ['canViewAuditLogs'],
  integrations:       ['canEditSettings'],
};

interface PageAccess {
  slug: string;
  can_view: number | boolean;
  can_edit: number | boolean;
  can_delete: number | boolean;
}

/**
 * Convert API response (list of page access rows) to AdminPermissions.
 */
function buildPermissionsFromAccess(accessRows: PageAccess[]): AdminPermissions {
  const perms: AdminPermissions = { ...EMPTY_PERMISSIONS };

  for (const row of accessRows) {
    if (!row.can_view && !row.can_edit && !row.can_delete) continue;
    const keys = SLUG_TO_PERMISSIONS[row.slug];
    if (keys) {
      for (const k of keys) {
        perms[k] = true;
      }
    }
  }

  // canDeleteData is true only if at least one page has can_delete
  perms.canDeleteData = accessRows.some(r => !!r.can_delete);

  return perms;
}

/**
 * Hook to get user permissions — fetches from backend API.
 * super_admin always gets full permissions.
 * Other admin/manager roles get permissions based on their assigned page access.
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuth();
  const isStaff = user && ['admin', 'super_admin', 'manager'].includes(user.role);
  const isSuperAdmin = user?.role === 'super_admin';

  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: async () => {
      const res = await api.getMyPermissions();
      return res.data as { role: string; access: PageAccess[] } | undefined;
    },
    enabled: !!isAuthenticated && !!isStaff && !isSuperAdmin,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  // super_admin always has everything
  if (isSuperAdmin) {
    return {
      permissions: FULL_PERMISSIONS,
      canAccess: (_p: keyof AdminPermissions) => true,
      hasAnyPermission: (_pl: (keyof AdminPermissions)[]) => true,
      hasAllPermissions: (_pl: (keyof AdminPermissions)[]) => true,
      isLoading: false,
    };
  }

  // While loading, deny all (will show loading state in PermissionGate)
  const permissions = data?.access
    ? buildPermissionsFromAccess(data.access)
    : EMPTY_PERMISSIONS;

  const canAccess = (permission: keyof AdminPermissions): boolean => {
    if (!isAuthenticated || !user) return false;
    return permissions[permission] === true;
  };

  const hasAnyPermission = (permissionList: (keyof AdminPermissions)[]): boolean => {
    return permissionList.some(canAccess);
  };

  const hasAllPermissions = (permissionList: (keyof AdminPermissions)[]): boolean => {
    return permissionList.every(canAccess);
  };

  return {
    permissions,
    canAccess,
    hasAnyPermission,
    hasAllPermissions,
    isLoading: isLoading && !!isStaff && !isSuperAdmin,
  };
}

/**
 * Utility to check specific permission (static, for non-hook contexts)
 */
export function checkPermission(
  userRole?: string,
  permission?: keyof AdminPermissions
): boolean {
  if (!userRole || !permission) return false;
  if (userRole === 'super_admin') return true;
  // For static checks without API data, deny by default (use the hook instead)
  return false;
}

/**
 * Legacy export for backwards compatibility
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, AdminPermissions> = {
  super_admin: FULL_PERMISSIONS,
  admin: EMPTY_PERMISSIONS,
  manager: EMPTY_PERMISSIONS,
  user: EMPTY_PERMISSIONS,
};
