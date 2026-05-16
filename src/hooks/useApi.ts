/**
 * useApi Hook
 * React hook for API calls with React Query integration
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api, ApiResponse, PaginatedResponse, type ContactMapPayload, type LandingThemePayload, type StorefrontRates, type TaxRateConfig } from '@/lib/api';

// ==================== GENERIC HOOKS ====================

/**
 * Hook for GET requests
 */
export function useApiQuery<T = any>(
  queryKey: (string | number)[],
  queryFn: () => Promise<ApiResponse<T>>,
  options?: Omit<UseQueryOptions<ApiResponse<T>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}

/**
 * Hook for POST/PUT/PATCH requests
 */
export function useApiMutation<TData = any, TError = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options?: Omit<UseMutationOptions<ApiResponse<TData>, TError, TVariables>, 'mutationFn'>
) {
  return useMutation<ApiResponse<TData>, TError, TVariables>({
    mutationFn,
    ...(options ?? {}),
  });
}

// ==================== AUTH HOOKS ====================

export function useLogin() {
  return useApiMutation(
    (credentials: { email: string; password: string }) =>
      api.login(credentials.email, credentials.password) as any,
    {
      onSuccess: () => {
        window.location.href = '/';
      },
    }
  );
}

export function useLogout() {
  return useApiMutation(
    () => api.logout(),
    {
      onSuccess: () => {
        const key = window.location.pathname.startsWith('/admin') ? 'remquip_admin_token' : 'remquip_auth_token';
        localStorage.removeItem(key);
        const path = typeof window !== 'undefined' ? window.location.pathname || '' : '';
        window.location.href = path.startsWith('/admin') ? '/admin/login' : '/login';
      },
    }
  );
}

export function useRegister() {
  return useApiMutation(
    (data: any) => api.register(data) as any,
    {
      onSuccess: () => {
        window.location.href = '/';
      },
    }
  );
}

// ==================== USER HOOKS ====================

export function useProfile() {
  return useApiQuery(['profile'], () => api.getProfile());
}

export function useUser(id: string) {
  return useApiQuery(['user', id], () => api.getUser(id), { enabled: !!id });
}

export function useUsers(page: number = 1, limit: number = 10) {
  return useApiQuery(['users', page, limit], () => api.getUsers(page, limit));
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.createUser(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
      },
    }
  );
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updateUser(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['user', id] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      },
    }
  );
}

export function useDeleteUser(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteUser(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
      },
    }
  );
}

export function useUpdatePassword(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updatePassword(id, data.currentPassword, data.newPassword),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['user', id] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      },
    }
  );
}

// ==================== PRODUCT HOOKS ====================

export function useProducts(page: number = 1, limit: number = 12) {
  return useApiQuery(['products', page, limit], () => api.getProducts(page, limit));
}

export function useProduct(id: string) {
  return useApiQuery(['product', id], () => api.getProduct(id), { enabled: !!id });
}

export function useFeaturedProducts() {
  return useApiQuery(['products', 'featured'], () => api.getFeaturedProducts());
}

export function useSearchProducts(query: string) {
  return useApiQuery(
    ['products', 'search', query],
    () => api.searchProducts(query),
    {
      enabled: query.length > 0,
    }
  );
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.createProduct(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }
  );
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updateProduct(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['product', id] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }
  );
}

export function useDeleteProduct(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteProduct(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }
  );
}

export function useUploadProductImage(productId: string) {
  const queryClient = useQueryClient();
  return useApiMutation((file: File) => api.uploadProductImage(productId, file), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ==================== CATEGORY HOOKS ====================

export function useCategories(locale: string = 'en') {
  return useApiQuery(['categories', locale], () => api.getCategories(1, 100, { locale }), {
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useAdminCategoriesList() {
  return useApiQuery(['categories', 'admin'], () => api.getCategories(1, 200, { admin: true }), {
    staleTime: 1000 * 60 * 2,
  });
}

export function useCategory(id: string, locale?: string) {
  return useApiQuery(['category', id, locale ?? 'en'], () => api.getCategory(id, locale));
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.createCategory(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['categories'] });
      },
    }
  );
}

export function useUpdateCategory(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updateCategory(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['category', id] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
      },
    }
  );
}

export function useDeleteCategory(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteCategory(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['categories'] });
      },
    }
  );
}

// ==================== CUSTOMER HOOKS ====================

export function useCustomers(page: number = 1, limit: number = 10) {
  return useApiQuery(['customers', page, limit], () => api.getCustomers(page, limit));
}

export function useCustomer(id: string) {
  return useApiQuery(['customer', id], () => api.getCustomer(id), { enabled: !!id });
}

export function useSearchCustomers(query: string) {
  return useApiQuery(
    ['customers', 'search', query],
    () => api.searchCustomers(query),
    {
      enabled: query.length > 0,
    }
  );
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.createCustomer(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
    }
  );
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updateCustomer(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['customer', id] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
    }
  );
}

export function useDeleteCustomer(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteCustomer(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
    }
  );
}

export function useCustomerOrders(customerId: string) {
  return useApiQuery(
    ['customer', customerId, 'orders'],
    () => api.getCustomerOrders(customerId),
    { enabled: !!customerId }
  );
}

export function useCustomerAddresses(customerId: string) {
  return useApiQuery(
    ['customer', customerId, 'addresses'],
    () => api.getCustomerAddresses(customerId),
    { enabled: !!customerId }
  );
}

/** CRM documents from `GET /uploads/contracts/:customerId` (admin). */
export function useCustomerDocuments(customerId: string) {
  return useApiQuery(
    ['customer', customerId, 'documents'],
    () => api.getCustomerDocuments(customerId),
    { enabled: !!customerId }
  );
}

// ==================== CUSTOMER CRM TASKS ====================
export function useCustomerTasks(customerId: string) {
  return useApiQuery(
    ['customer', customerId, 'tasks'],
    () => api.getCustomerTasks(customerId),
    { enabled: !!customerId }
  );
}

export function useCreateCustomerTask() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { customerId: string; payload: Parameters<typeof api.createCustomerTask>[1] }) =>
      api.createCustomerTask(vars.customerId, vars.payload),
    {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: ['customer', vars.customerId, 'tasks'] });
      },
    }
  );
}

export function useUpdateCustomerTask() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { taskId: string; payload: Partial<Parameters<typeof api.updateCustomerTask>[1]> }) =>
      api.updateCustomerTask(vars.taskId, vars.payload as any),
    {
      onSuccess: (_res, vars) => {
        // Customer tasks queries are keyed by `['customer', customerId, 'tasks']`,
        // and we don't have customerId here. Invalidate the customer group.
        queryClient.invalidateQueries({ queryKey: ['customer'] });
      },
    }
  );
}

export function useDeleteCustomerTask() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (taskId: string) => api.deleteCustomerTask(taskId),
    {
      onSuccess: () => {
        // Caller will re-fetch by invalidating customer tasks queries.
        queryClient.invalidateQueries({ queryKey: ['customer'] });
      },
    }
  );
}

// ==================== ADMIN CONTACTS (owner assignment) ====================
export function useAvailableAdminContacts() {
  return useApiQuery(['admin-contacts', 'available'], () => api.getAvailableAdminContacts(), {
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdminContactsListAll() {
  return useApiQuery(['admin-contacts', 'all'], () => api.getAllAdminContacts(), {
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateAdminContact() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: Record<string, unknown>) => api.createAdminContact(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-contacts'] });
      },
    }
  );
}

export function useUpdateAdminContact() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { id: string; data: Record<string, unknown> }) => api.updateAdminContact(vars.id, vars.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-contacts'] });
      },
    }
  );
}

export function useDeleteAdminContact() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (id: string) => api.deleteAdminContact(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-contacts'] });
      },
    }
  );
}

// ==================== ORDER HOOKS ====================

export function useOrders(page: number = 1, limit: number = 10) {
  return useApiQuery(['orders', page, limit], () => api.getOrders(page, limit));
}

export function useOrder(id: string) {
  return useApiQuery(['order', id], () => api.getOrder(id), { enabled: !!id });
}

export function useSearchOrders(query: string) {
  return useApiQuery(
    ['orders', 'search', query],
    () => api.searchOrders(query),
    {
      enabled: query.length > 0,
    }
  );
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.createOrder(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }
  );
}

export function useUpdateOrder(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updateOrder(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['order', id] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }
  );
}

export function useUpdateOrderStatus(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (status: any) => api.updateOrderStatus(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['order', id] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }
  );
}

export function useDeleteOrder(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteOrder(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }
  );
}

export function useAddOrderNote(orderId: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (note: string) => api.addOrderNote(orderId, note),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      },
    }
  );
}

// ==================== STRIPE HOOKS ====================

export function useCreateStripeSession() {
  return useApiMutation((orderId: string) => api.createStripeCheckoutSession(orderId));
}

// ==================== DISCOUNT HOOKS ====================

export function useDiscounts(page: number = 1, limit: number = 10) {
  return useApiQuery(['discounts', page, limit], () => api.getDiscounts(page, limit));
}

export function useDiscount(id: string) {
  return useApiQuery(['discount', id], () => api.getDiscount(id));
}

export function useValidateDiscount(code: string) {
  return useApiQuery(
    ['discount', 'validate', code],
    () => api.validateDiscount(code),
    {
      enabled: code.length > 0,
    }
  );
}

export function useCreateDiscount() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.createDiscount(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['discounts'] });
      },
    }
  );
}

export function useUpdateDiscount(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updateDiscount(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['discount', id] });
        queryClient.invalidateQueries({ queryKey: ['discounts'] });
      },
    }
  );
}

export function useDeleteDiscount(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteDiscount(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['discounts'] });
      },
    }
  );
}

// ==================== INVENTORY HOOKS ====================

export function useInventoryLogs(page: number = 1, limit: number = 20) {
  return useApiQuery(['inventory', 'logs', page, limit], () =>
    api.getInventoryLogs(page, limit)
  );
}

export function useLowStockProducts() {
  return useApiQuery(['inventory', 'low-stock'], () => api.getLowStockProducts(), {
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.adjustInventory(data.productId, data.quantity, data.reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
    }
  );
}

export function useProductHistory(productId: string) {
  return useApiQuery(['product', productId, 'history'], () =>
    api.getProductHistory(productId)
  );
}

// ==================== ANALYTICS HOOKS ====================

export function useAnalyticsDashboard() {
  return useApiQuery(['analytics', 'dashboard'], () => api.getAnalyticsDashboard(), {
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAnalyticsMetrics(startDate: string, endDate: string) {
  return useApiQuery(
    ['analytics', 'metrics', startDate, endDate],
    () => api.getAnalyticsMetrics(startDate, endDate)
  );
}

export function useRevenueStats(startDate: string, endDate: string) {
  return useApiQuery(
    ['analytics', 'revenue', startDate, endDate],
    () => api.getRevenueStats(startDate, endDate)
  );
}

/** Backend `GET /analytics/sales?period=day|week|month|year` — revenue series for charts. */
export function useAnalyticsSales(period?: string) {
  return useApiQuery(['analytics', 'sales', period ?? 'default'], () => api.getAnalyticsSales(period), {
    staleTime: 1000 * 60 * 2,
  });
}

export function useAnalyticsEvents(limit = 50, offset = 0, eventType?: string) {
  return useApiQuery(
    ['analytics', 'events', limit, offset, eventType ?? ''],
    () => api.getAnalyticsEvents({ limit, offset, event_type: eventType }),
    { staleTime: 1000 * 60 }
  );
}

export function useAnalyticsEventsSummary(days = 30) {
  return useApiQuery(['analytics', 'events', 'summary', days], () => api.getAnalyticsEventsSummary(days), {
    staleTime: 1000 * 60 * 2,
  });
}

// ==================== SETTINGS & FILE REGISTRY ====================

export function usePublicSettings() {
  return useApiQuery(['settings', 'public'], () => api.getPublicSettings(), {
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useStorefrontRates() {
  return useApiQuery<StorefrontRates>(['settings', 'storefront'], () => api.getStorefrontSettings(), {
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
}

/** Contact page map — public GET; invalidate after admin save. Read pin with `data?.data`. */
export function useContactMap() {
  return useApiQuery<ContactMapPayload>(['contact-map'], () => api.getContactMap(), {
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

export function useUpdateContactMap() {
  const queryClient = useQueryClient();
  return useApiMutation((body: Parameters<typeof api.updateContactMap>[0]) => api.updateContactMap(body), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-map'] });
    },
  });
}

export function useLandingTheme() {
  return useApiQuery<LandingThemePayload>(['landing-theme'], () => api.getLandingTheme(), {
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

export function useUpdateLandingTheme() {
  const queryClient = useQueryClient();
  return useApiMutation((body: Partial<LandingThemePayload>) => api.updateLandingTheme(body), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-theme'] });
    },
  });
}

export function useAdminSettingsList() {
  return useApiQuery(['settings', 'admin'], () => api.getAdminSettings(), {
    staleTime: 1000 * 60 * 2,
  });
}

export function usePatchSettingsBulk() {
  const queryClient = useQueryClient();
  return useApiMutation((settings: Record<string, string | number | boolean>) => api.patchSettingsBulk(settings), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useRegistryFiles(limit = 50, offset = 0) {
  return useApiQuery(['uploads', 'registry', limit, offset], () => api.listRegistryFiles(limit, offset), {
    staleTime: 1000 * 60 * 2,
  });
}

export function useUploadRegistryFile() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { file: File; uploadType?: string }) =>
      api.uploadRegistryFile(vars.file, { uploadType: vars.uploadType ?? 'admin_misc' }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['uploads', 'registry'] });
      },
    }
  );
}

export function useDeleteRegistryFile() {
  const queryClient = useQueryClient();
  return useApiMutation((id: string) => api.deleteRegistryFile(id), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads', 'registry'] });
    },
  });
}

// ==================== CMS HOOKS ====================

export function useCMSPages(page: number = 1, limit: number = 10) {
  return useApiQuery(['cms', 'pages', page, limit], () =>
    api.getCMSPages(page, limit)
  );
}

export function useCMSPage(slug: string, locale?: string) {
  return useApiQuery(['cms', 'page', slug, locale ?? 'en'], () => api.getCMSPage(slug, locale), {
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useCreateCMSPage() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.createCMSPage(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] });
      },
    }
  );
}

export function useUpdateCMSPage(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: any) => api.updateCMSPage(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] });
      },
    }
  );
}

export function useDeleteCMSPage(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteCMSPage(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] });
      },
    }
  );
}

// ==================== AUDIT HOOKS ====================

export function useAuditLogs(page: number = 1, limit: number = 20) {
  return useApiQuery(['audit', 'logs', page, limit], () =>
    api.getAuditLogs(page, limit)
  );
}

export function useUserAuditLogs(userId: string, page: number = 1, limit: number = 20) {
  return useApiQuery(
    ['audit', 'logs', 'user', userId, page, limit],
    () => api.getUserAuditLogs(userId, page, limit)
  );
}

// ==================== ACCESS CONTROL HOOKS ====================

export function useUserPermissions(userId: string) {
  return useApiQuery(
    ['permissions', 'user', userId],
    () => api.getUserPermissions(userId),
    { enabled: !!userId }
  );
}

export function useAllPermissions() {
  return useApiQuery(['permissions', 'all'], () => api.getAllPermissions());
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ userId, permissions }: { userId: string; permissions: any }) =>
      api.updateUserPermissions(userId, permissions),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['permissions'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      },
    }
  );
}

// ==================== ORDER / OFFER DOCUMENTS ====================

export function useOrderDocuments(orderId: string) {
  return useApiQuery(
    ['order', orderId, 'documents'],
    () => api.getOrderDocuments(orderId),
    { enabled: !!orderId }
  );
}

export function useUploadOrderDocument() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { file: File; orderId: string; documentType?: string }) => 
      api.uploadOrderDocument(vars.file, vars.orderId, vars.documentType),
    {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: ['order', vars.orderId, 'documents'] });
        queryClient.invalidateQueries({ queryKey: ['order', vars.orderId] });
      },
    }
  );
}

export function useDeleteOrderDocument() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { orderId: string; documentId: string }) => 
      api.deleteOrderDocument(vars.orderId, vars.documentId),
    {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: ['order', vars.orderId, 'documents'] });
        queryClient.invalidateQueries({ queryKey: ['order', vars.orderId] });
      },
    }
  );
}

export function useOfferDocuments(offerId: string) {
  return useApiQuery(
    ['offer', offerId, 'documents'],
    () => api.getOfferDocuments(offerId),
    { enabled: !!offerId }
  );
}

export function useUploadOfferDocument() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { file: File; offerId: string; documentType?: string }) => 
      api.uploadOfferDocument(vars.file, vars.offerId, vars.documentType),
    {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: ['offer', vars.offerId, 'documents'] });
        queryClient.invalidateQueries({ queryKey: ['offer', vars.offerId] });
      },
    }
  );
}

export function useDeleteOfferDocument() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { offerId: string; documentId: string }) => 
      api.deleteOfferDocument(vars.offerId, vars.documentId),
    {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: ['offer', vars.offerId, 'documents'] });
        queryClient.invalidateQueries({ queryKey: ['offer', vars.offerId] });
      },
    }
  );
}

// ==================== OFFERS HOOKS ====================

export function useOffers(page: number = 1, limit: number = 20, status?: string, search?: string) {
  return useApiQuery(
    ['offers', page, limit, status, search],
    () => api.getOffers(page, limit, status, search)
  );
}

export function useOffer(id: string) {
  return useApiQuery(
    ['offer', id],
    () => api.getOffer(id),
    { enabled: !!id }
  );
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: Record<string, unknown>) => api.createOffer(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      },
    }
  );
}

export function useUpdateOffer(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: Record<string, unknown>) => api.updateOffer(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['offer', id] });
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      },
    }
  );
}

export function useUpdateOfferStatus(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (status: string) => api.updateOfferStatus(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['offer', id] });
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      },
    }
  );
}

export function useConvertOfferToOrder() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (id: string) => api.convertOfferToOrder(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['offer'] });
        queryClient.invalidateQueries({ queryKey: ['offers'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }
  );
}

export function useConvertOfferToInvoice() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (id: string) => api.convertOfferToInvoice(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['offer'] });
        queryClient.invalidateQueries({ queryKey: ['offers'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
}

export function useDeleteOffer(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteOffer(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      },
    }
  );
}

export function useSendOfferEmail() {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ offerId, message, subject }: { offerId: string; message?: string; subject?: string }) =>
      api.sendOfferEmail(offerId, { message, subject }),
    {
      onSuccess: (_data, vars) => {
        // Auto-status advance: refresh the offer so it shows 'sent'
        queryClient.invalidateQueries({ queryKey: ['offer', vars.offerId] });
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      },
    }
  );
}

export function useSendOrderEmail() {
  return useApiMutation(
    ({ orderId, emailType, message, subject }: { orderId: string; emailType?: string; message?: string; subject?: string }) =>
      api.sendOrderEmail(orderId, { email_type: emailType, message, subject })
  );
}

// ==================== CUSTOMER NOTES ====================

export function useAddCustomerNote() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { customerId: string; note: string; isInternal?: boolean }) =>
      api.addCustomerNote(vars.customerId, { note: vars.note, isInternal: vars.isInternal }),
    {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: ['customer', vars.customerId] });
      },
    }
  );
}

// ==================== DASHBOARD HOOKS ====================

export function useDashboardStats() {
  return useApiQuery(['dashboard', 'stats'], () => api.getDashboardStats(), {
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useDashboardRecentOrders() {
  return useApiQuery(['dashboard', 'recent-orders'], () => api.getDashboardRecentOrders(), {
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useDashboardActivityLog() {
  return useApiQuery(['dashboard', 'activity-log'], () => api.getDashboardActivityLog(), {
    staleTime: 1000 * 60 * 2,
  });
}

export function useDashboardTopProducts() {
  return useApiQuery(['dashboard', 'top-products'], () => api.getDashboardTopProducts(), {
    staleTime: 1000 * 60 * 5,
  });
}

// ==================== TAX RATES HOOKS ====================

/** Public: active tax rates (used by cart, checkout, reports). */
export function useTaxRates() {
  return useApiQuery<TaxRateConfig[]>(['tax-rates'], () => api.getTaxRates(), {
    staleTime: 1000 * 60 * 10,
  });
}

/** Admin: all tax rates including inactive. */
export function useAllTaxRates() {
  return useApiQuery<TaxRateConfig[]>(['tax-rates', 'all'], () => api.getAllTaxRates(), {
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateTaxRate() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: Partial<TaxRateConfig>) => api.createTaxRate(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
      },
    }
  );
}

export function useUpdateTaxRate() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (vars: { id: string; data: Partial<TaxRateConfig> }) => api.updateTaxRate(vars.id, vars.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
      },
    }
  );
}

export function useDeleteTaxRate() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (id: string) => api.deleteTaxRate(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
      },
    }
  );
}

// ==================== INVOICE HOOKS ====================

export function useInvoices(page: number = 1, limit: number = 20, filters?: { status?: string; payment_status?: string; search?: string }) {
  return useApiQuery(
    ['invoices', page, limit, filters?.status ?? '', filters?.payment_status ?? '', filters?.search ?? ''],
    () => api.getInvoices(page, limit, filters),
  );
}

export function useInvoice(id: string) {
  return useApiQuery(['invoice', id], () => api.getInvoice(id), { enabled: !!id });
}

export function useInvoiceStats() {
  return useApiQuery(['invoices', 'stats'], () => api.getInvoiceStats(), {
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: Record<string, unknown>) => api.createInvoice(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: Record<string, unknown>) => api.updateInvoice(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoice', id] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
}

export function useUpdateInvoiceStatus(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (status: string) => api.updateInvoiceStatus(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoice', id] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
}

export function useRecordInvoicePayment(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    (data: { amount: number; payment_method?: string; reference?: string; notes?: string }) =>
      api.recordInvoicePayment(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoice', id] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
}

export function useSendInvoiceEmail() {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ invoiceId, message, subject }: { invoiceId: string; message?: string; subject?: string }) =>
      api.sendInvoiceEmail(invoiceId, { message, subject }),
    {
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({ queryKey: ['invoice', vars.invoiceId] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
}

export function useDeleteInvoice(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation(
    () => api.deleteInvoice(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
}
