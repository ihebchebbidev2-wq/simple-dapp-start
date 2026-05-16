import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, AUTH_TOKEN_KEY_ADMIN } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CartProvider } from "@/contexts/CartContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import PublicLayout from "@/components/layout/PublicLayout";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { ChatWidget } from "@/components/chat/ChatWidget";
import ScrollToTop from "@/components/ScrollToTop";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import ProtectedRoute from "@/components/ProtectedRoute";
import { GlobalToastBridge } from "@/components/GlobalToastBridge";
// TaskReminderModal moved into AdminLayout — admin-only by design

import HomeLandingRoute from "@/pages/HomeLandingRoute";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { lazyRetry } from "@/lib/lazyRetry";

// Lazy-loaded routes with auto-retry on chunk failures
const AboutPage = lazyRetry(() => import("@/pages/AboutPage"));
const ProductsPage = lazyRetry(() => import("@/pages/ProductsPage"));
const ProductDetailPage = lazyRetry(() => import("@/pages/ProductDetailPage"));
const CartPage = lazyRetry(() => import("@/pages/CartPage"));
const CheckoutPage = lazyRetry(() => import("@/pages/CheckoutPage"));
const OrderConfirmedPage = lazyRetry(() => import("@/pages/OrderConfirmedPage"));
const PaymentSuccessPage = lazyRetry(() => import("@/pages/PaymentSuccessPage"));
const PaymentCancelPage = lazyRetry(() => import("@/pages/PaymentCancelPage"));
const LoginPage = lazyRetry(() => import("@/pages/LoginPage"));
const RegisterPage = lazyRetry(() => import("@/pages/RegisterPage"));
const ForgotPasswordPage = lazyRetry(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazyRetry(() => import("@/pages/ResetPasswordPage"));
const CustomerDashboardPage = lazyRetry(() => import("@/pages/CustomerDashboardPage"));
const ContactPage = lazyRetry(() => import("@/pages/ContactPage"));
const LegalPage = lazyRetry(() => import("@/pages/LegalPage"));
const AdminLayout = lazyRetry(() => import("@/components/layout/AdminLayout"));
const AdminOverview = lazyRetry(() => import("@/pages/admin/AdminOverview"));
const AdminProducts = lazyRetry(() => import("@/pages/admin/AdminProducts"));
const AdminProductEdit = lazyRetry(() => import("@/pages/admin/AdminProductEdit"));
const AdminInventory = lazyRetry(() => import("@/pages/admin/AdminInventory"));
const AdminOrders = lazyRetry(() => import("@/pages/admin/AdminOrders"));
const AdminOffers = lazyRetry(() => import("@/pages/admin/AdminOffers"));
const AdminCustomers = lazyRetry(() => import("@/pages/admin/AdminCustomers"));
const AdminContractCustomers = lazyRetry(() => import("@/pages/admin/AdminContractCustomers"));
const AdminLeads = lazyRetry(() => import("@/pages/admin/AdminLeads"));

const AdminLanding = lazyRetry(() => import("@/pages/admin/AdminLanding"));
const AdminCMS = lazyRetry(() => import("@/pages/admin/AdminCMS"));
const AdminCategories = lazyRetry(() => import("@/pages/admin/AdminCategories"));
const AdminCarts = lazyRetry(() => import("@/pages/admin/AdminCarts"));
const AdminAnalytics = lazyRetry(() => import("@/pages/admin/AdminAnalytics"));
const AdminSettings = lazyRetry(() => import("@/pages/admin/AdminSettings"));
const AdminProductLogs = lazyRetry(() => import("@/pages/admin/AdminProductLogs"));
const AdminProductDetail = lazyRetry(() => import("@/pages/admin/AdminProductDetail"));
const AdminInvoices = lazyRetry(() => import("@/pages/admin/AdminInvoices"));
const AdminDiscounts = lazyRetry(() => import("@/pages/admin/AdminDiscounts"));
const AdminTaxRates = lazyRetry(() => import("@/pages/admin/AdminTaxRates"));
const AdminUsers = lazyRetry(() => import("@/pages/admin/AdminUsers"));
const AdminAccess = lazyRetry(() => import("@/pages/admin/AdminAccess"));
const AdminSetupAdmins = lazyRetry(() => import("@/pages/admin/AdminSetupAdmins"));
const UserDashboard = lazyRetry(() => import("@/pages/UserDashboard"));
const AdminChat = lazyRetry(() => import("@/pages/admin/AdminChat"));
const AdminApplications = lazyRetry(() => import("@/pages/admin/AdminApplications"));
const CustomerApplicationPage = lazyRetry(() => import("@/pages/CustomerApplicationPage"));
const FAQPage = lazyRetry(() => import("@/pages/FAQPage"));
const NotFound = lazyRetry(() => import("@/pages/NotFound"));
const AdminDocs = lazyRetry(() => import("@/pages/admin/AdminDocs"));
const AdminSEO = lazyRetry(() => import("@/pages/admin/AdminSEO"));
const AdminIntegrations = lazyRetry(() => import("@/pages/admin/AdminIntegrations"));
const AdminIntegrationsSync = lazyRetry(() => import("@/pages/admin/AdminIntegrationsSync"));
const AdminIntegrationsOAuthCallback = lazyRetry(() => import("@/pages/admin/AdminIntegrationsOAuthCallback"));
const AdminTasks = lazyRetry(() => import("@/pages/admin/AdminTasks"));
const AdminLeadStatuses = lazyRetry(() => import("@/pages/admin/AdminLeadStatuses"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return <RemquipLoadingScreen variant="fullscreen" message="Loading" />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <CartProvider>
          <TooltipProvider>
            <ErrorBoundary>
            <ConfirmProvider>
              <Toaster />
              <Sonner />
              <GlobalToastBridge />
              <BrowserRouter>
                <ScrollToTop />
                <CookieConsent />
                <ChatWidget />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public */}
                    <Route element={<PublicLayout />}>
                      <Route path="/" element={<HomeLandingRoute />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/products/:categorySlug" element={<ProductsPage />} />
                      <Route path="/product/:slug" element={<ProductDetailPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/checkout" element={<ProtectedRoute requiredRole="user" fallbackPath="/login"><CheckoutPage /></ProtectedRoute>} />
                      <Route path="/payment-success" element={<PaymentSuccessPage />} />
                      <Route path="/payment-cancel" element={<PaymentCancelPage />} />
                      <Route path="/order-confirmed" element={<OrderConfirmedPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/account" element={<CustomerDashboardPage />} />
                      <Route path="/dashboard" element={<UserDashboard />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/terms" element={<LegalPage titleKey="legal.terms.title" contentKey="legal.terms.content" />} />
                      <Route path="/privacy" element={<LegalPage titleKey="legal.privacy.title" contentKey="legal.privacy.content" />} />
                      <Route path="/shipping" element={<LegalPage titleKey="legal.shipping.title" contentKey="legal.shipping.content" />} />
                      <Route path="/refund" element={<LegalPage titleKey="legal.refund.title" contentKey="legal.refund.content" />} />
                      <Route path="/cookie" element={<LegalPage titleKey="legal.cookie.title" contentKey="legal.cookie.content" />} />
                      <Route path="/eula" element={<LegalPage titleKey="legal.eula.title" contentKey="legal.eula.content" />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/faq" element={<FAQPage />} />
                      <Route path="/apply" element={<CustomerApplicationPage />} />
                    </Route>

                    {/* Admin sign-in (no storefront chrome) — separate auth session */}
                    <Route path="/admin/login" element={<AuthProvider tokenKey={AUTH_TOKEN_KEY_ADMIN}><LoginPage /></AuthProvider>} />

                    {/* Hidden internal admin setup (create new admins with full permissions) */}
                    <Route path="/admin/setup-admins" element={<AuthProvider tokenKey={AUTH_TOKEN_KEY_ADMIN}><AdminSetupAdmins /></AuthProvider>} />

                    {/* Admin — separate auth session from storefront */}
                    <Route path="/admin" element={<AuthProvider tokenKey={AUTH_TOKEN_KEY_ADMIN}><AdminLayout /></AuthProvider>}>
                      <Route index element={<PermissionGate permission="canViewDashboard"><AdminOverview /></PermissionGate>} />
                      <Route path="analytics"  element={<PermissionGate permission="canManageAnalytics"><AdminAnalytics /></PermissionGate>} />
                      <Route path="products"   element={<PermissionGate permission="canManageProducts"><AdminProducts /></PermissionGate>} />
                      <Route path="categories" element={<PermissionGate permission="canManageProducts"><AdminCategories /></PermissionGate>} />
                      <Route path="products/new"              element={<PermissionGate permission="canManageProducts"><AdminProductEdit /></PermissionGate>} />
                      <Route path="products/:productId"       element={<PermissionGate permission="canManageProducts"><AdminProductEdit /></PermissionGate>} />
                      <Route path="products/:productId/view"  element={<PermissionGate permission="canManageProducts"><AdminProductDetail /></PermissionGate>} />
                      <Route path="products/:productId/logs"  element={<PermissionGate permission="canManageProducts"><AdminProductLogs /></PermissionGate>} />
                      <Route path="inventory"      element={<PermissionGate permission="canManageInventory"><AdminInventory /></PermissionGate>} />
                      <Route path="orders"         element={<PermissionGate permission="canManageOrders"><AdminOrders /></PermissionGate>} />
                      <Route path="orders/:orderId" element={<PermissionGate permission="canManageOrders"><AdminOrders /></PermissionGate>} />
                      <Route path="offers"         element={<PermissionGate permission="canManageOrders"><AdminOffers /></PermissionGate>} />
                      <Route path="offers/:offerId" element={<PermissionGate permission="canManageOrders"><AdminOffers /></PermissionGate>} />
                      <Route path="carts"          element={<PermissionGate permission="canManageOrders"><AdminCarts /></PermissionGate>} />
                      <Route path="customers"      element={<PermissionGate permission="canManageCustomers"><AdminCustomers /></PermissionGate>} />
                      <Route path="customers/:customerId" element={<PermissionGate permission="canManageCustomers"><AdminCustomers /></PermissionGate>} />
                      <Route path="contract-customers" element={<PermissionGate permission="canManageCustomers"><AdminContractCustomers /></PermissionGate>} />
                      <Route path="contract-customers/:customerId" element={<PermissionGate permission="canManageCustomers"><AdminContractCustomers /></PermissionGate>} />
                      <Route path="leads" element={<PermissionGate permission="canManageCustomers"><AdminLeads /></PermissionGate>} />
                      <Route path="leads/:customerId" element={<PermissionGate permission="canManageCustomers"><AdminLeads /></PermissionGate>} />
                      <Route path="discounts"      element={<PermissionGate permission="canManageDiscounts"><AdminDiscounts /></PermissionGate>} />
                      <Route path="invoices"      element={<PermissionGate permission="canManageOrders"><AdminInvoices /></PermissionGate>} />
                      <Route path="invoices/:invoiceId" element={<PermissionGate permission="canManageOrders"><AdminInvoices /></PermissionGate>} />
                      <Route path="tax-rates"      element={<PermissionGate permission="canManageTaxRates"><AdminTaxRates /></PermissionGate>} />
                      <Route path="landing"        element={<PermissionGate permission="canManageCMS"><AdminLanding /></PermissionGate>} />
                      <Route path="cms"            element={<PermissionGate permission="canManageCMS"><AdminCMS /></PermissionGate>} />
                      <Route path="users"          element={<PermissionGate permission="canManageUsers"><AdminUsers /></PermissionGate>} />
                      
                      <Route path="access"         element={<PermissionGate permission="canManageUsers"><AdminAccess /></PermissionGate>} />
                      <Route path="settings"       element={<PermissionGate permission="canEditSettings"><AdminSettings /></PermissionGate>} />
                      <Route path="chat"           element={<PermissionGate permission="canViewDashboard"><AdminChat /></PermissionGate>} />
                      <Route path="applications"   element={<PermissionGate permission="canManageCustomers"><AdminApplications /></PermissionGate>} />
                      <Route path="docs"           element={<PermissionGate permission="canViewDashboard"><AdminDocs /></PermissionGate>} />
                      <Route path="seo"            element={<PermissionGate permission="canManageCMS"><AdminSEO /></PermissionGate>} />
                      <Route path="integrations"   element={<PermissionGate permission="canEditSettings"><AdminIntegrations /></PermissionGate>} />
                      <Route path="integrations/sync" element={<PermissionGate permission="canEditSettings"><AdminIntegrationsSync /></PermissionGate>} />
                      <Route path="integrations/oauth/:provider" element={<PermissionGate permission="canEditSettings"><AdminIntegrationsOAuthCallback /></PermissionGate>} />
                      <Route path="tasks"          element={<PermissionGate permission="canManageCustomers"><AdminTasks /></PermissionGate>} />
                      <Route path="lead-statuses"  element={<PermissionGate permission="canManageCustomers"><AdminLeadStatuses /></PermissionGate>} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </ConfirmProvider>
            </ErrorBoundary>
          </TooltipProvider>
        </CartProvider>
      </CurrencyProvider>
    </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
