import React, { useState } from "react";
import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Package, Warehouse, ShoppingBag, ShoppingCart, Users, FileText,
  BarChart3, Settings, ChevronLeft, Menu, X, Tag, Shield, Layers, LayoutTemplate,
  Phone, MessageCircle, LogOut, ExternalLink, Globe, Receipt, BookOpen, Search as SearchIcon,
  FileSignature, UserPlus, Plug, ListTodo,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, localeLabel, localeFlag } from "@/contexts/LanguageContext";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { usePermissions, AdminPermissions } from "@/hooks/usePermissions";
import { AdminGlobalSearch } from "@/components/admin/AdminGlobalSearch";
import FlagIcon from "@/components/FlagIcon";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useUpcomingTasks } from "@/hooks/useUpcomingTasks";
import { TaskReminderModal } from "@/components/admin/TaskReminderModal";


type NavItem = {
  labelKey: string;
  icon: React.ElementType;
  path: string;
  permission?: keyof AdminPermissions;
};

type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    labelKey: "admin.nav.group.main",
    items: [
      { labelKey: "admin.nav.overview",   icon: LayoutDashboard, path: "/admin",            permission: "canViewDashboard" },
      { labelKey: "admin.nav.analytics",  icon: BarChart3,        path: "/admin/analytics",  permission: "canManageAnalytics" },
    ],
  },
  {
    labelKey: "admin.nav.group.catalog",
    items: [
      { labelKey: "admin.nav.products",   icon: Package,  path: "/admin/products",   permission: "canManageProducts" },
      { labelKey: "admin.nav.categories", icon: Layers,   path: "/admin/categories", permission: "canManageProducts" },
      { labelKey: "admin.nav.inventory",  icon: Warehouse, path: "/admin/inventory", permission: "canManageInventory" },
    ],
  },
  {
    labelKey: "admin.nav.group.sales",
    items: [
      { labelKey: "admin.nav.orders",          icon: ShoppingBag,  path: "/admin/orders",        permission: "canManageOrders" },
      { labelKey: "admin.nav.offers",          icon: FileText,     path: "/admin/offers",        permission: "canManageOrders" },
      { labelKey: "admin.nav.abandoned_carts", icon: ShoppingCart, path: "/admin/carts",         permission: "canManageOrders" },
      { labelKey: "admin.nav.customers",          icon: Users,        path: "/admin/customers",          permission: "canManageCustomers" },
      { labelKey: "admin.nav.leads",               icon: UserPlus,     path: "/admin/leads",              permission: "canManageCustomers" },
      { labelKey: "admin.nav.contract_customers",  icon: FileSignature, path: "/admin/contract-customers", permission: "canManageCustomers" },
      { labelKey: "admin.nav.applications",        icon: FileText,     path: "/admin/applications",       permission: "canManageCustomers" },
      { labelKey: "admin.nav.tasks",               icon: ListTodo,     path: "/admin/tasks",              permission: "canManageCustomers" },
      { labelKey: "admin.nav.lead_statuses",       icon: Tag,          path: "/admin/lead-statuses",      permission: "canManageCustomers" },
      { labelKey: "admin.nav.discounts",       icon: Tag,          path: "/admin/discounts",     permission: "canManageDiscounts" },
    ],
  },
  {
    labelKey: "admin.nav.group.finance",
    items: [
      { labelKey: "admin.nav.invoices",  icon: FileText,  path: "/admin/invoices",  permission: "canManageOrders" },
      { labelKey: "admin.nav.tax_rates", icon: Receipt, path: "/admin/tax-rates", permission: "canManageTaxRates" },
    ],
  },
  {
    labelKey: "admin.nav.group.content",
    items: [
      { labelKey: "admin.nav.landing", icon: LayoutTemplate, path: "/admin/landing", permission: "canManageCMS" },
      { labelKey: "admin.nav.cms",     icon: FileText,        path: "/admin/cms",     permission: "canManageCMS" },
      { labelKey: "admin.nav.seo",     icon: SearchIcon,      path: "/admin/seo",     permission: "canManageCMS" },
    ],
  },
  {
    labelKey: "admin.nav.group.system",
    items: [
      { labelKey: "admin.nav.users",          icon: Users,          path: "/admin/users",          permission: "canManageUsers" },
      
      { labelKey: "admin.nav.access_control", icon: Shield,         path: "/admin/access",         permission: "canManageUsers" },
      { labelKey: "admin.nav.chat_inbox",     icon: MessageCircle,  path: "/admin/chat",           permission: "canViewDashboard" },
      { labelKey: "admin.nav.settings",       icon: Settings,       path: "/admin/settings",       permission: "canEditSettings" },
      { labelKey: "admin.nav.integrations",    icon: Plug,           path: "/admin/integrations",   permission: "canEditSettings" },
      { labelKey: "admin.nav.docs",            icon: BookOpen,       path: "/admin/docs",           permission: "canViewDashboard" },
    ],
  },
];


function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return "admin.greeting.morning";
  if (h < 18) return "admin.greeting.afternoon";
  return "admin.greeting.evening";
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "AD";
}

export default function AdminLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t, lang, setLang, supportedLocales } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const { canAccess, isLoading: isPermissionsLoading } = usePermissions();
  const { unreadCount } = useChatNotifications(isAuthenticated);
  const { count: upcomingTaskCount, tasks: upcomingTasks } = useUpcomingTasks(isAuthenticated);

  // Break upcoming-task count down by customer category so the sidebar tells admins
  // *who* needs attention (lead vs normal customer vs contract customer).
  const tasksByCategory = React.useMemo(() => {
    const buckets = { lead: 0, customer: 0, contract: 0 } as { lead: number; customer: number; contract: number };
    for (const t of upcomingTasks) {
      const cat = (t.customer_category ?? "customer") as "lead" | "customer" | "contract";
      if (cat in buckets) buckets[cat] += 1;
      else buckets.customer += 1;
    }
    return buckets;
  }, [upcomingTasks]);

  // Show loading state while checking auth or permissions
  if (isLoading || isPermissionsLoading) {
    return <RemquipLoadingScreen variant="fullscreen" message="Verifying admin access" />;
  }

  // Always require login — regardless of ADMIN_NO_AUTH (that flag only affects backend API token bypass)
  if (!isAuthenticated || !user) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/admin/login?redirect=${encodeURIComponent(returnTo)}`}
        state={{ from: location }}
        replace
      />
    );
  }

  // Only admin-level roles can enter the admin panel
  const isAdminRole = user.role === 'admin' || user.role === 'super_admin' || user.role === 'manager';
  if (!isAdminRole) {
    return <Navigate to="/" replace />;
  }

  // Filter nav items to only show ones the user has permission to access
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || canAccess(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const allVisibleItems = visibleGroups.flatMap((g) => g.items);

  const currentPage = allVisibleItems.find(
    (item) => location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path))
  );

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/admin" && location.pathname.startsWith(path));

  const initials = getInitials(user?.full_name, user?.email);
  const displayName = user?.full_name || user?.email || "Admin";
  const displayRole = user?.role?.replace(/_/g, " ") || "admin";

  /* ── Sidebar content (shared between mobile & desktop) ── */
  function NavContent({ isMobile = false }: { isMobile?: boolean }) {
    return (
      <>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          {!collapsed || isMobile ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <span className="font-display text-xs font-black text-sidebar-primary-foreground">R</span>
              </div>
              <span className="font-display text-base font-bold tracking-wider text-sidebar-foreground">REMQUIP</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
              <span className="font-display text-xs font-black text-sidebar-primary-foreground">R</span>
            </div>
          )}
          {isMobile ? (
            <button onClick={() => setMobileNav(false)} className="text-sidebar-foreground p-1 rounded-lg hover:bg-sidebar-accent transition-colors">
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={() => setCollapsed(!collapsed)} className="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded-lg hover:bg-sidebar-accent transition-colors">
              {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto admin-scroll space-y-1">
          {visibleGroups.map((group, gi) => (
            <div key={group.labelKey}>
              {(!collapsed || isMobile) && (
                <div className="admin-section-label mt-3 first:mt-0 mb-1 px-2">
                  <span>{t(group.labelKey)}</span>
                </div>
              )}
              {collapsed && !isMobile && gi > 0 && (
                <div className="mx-3 my-2 border-t border-sidebar-border/40" />
              )}
              {group.items.map((item) => {
                const active = isActive(item.path);
                // Each customer-segment row shows ONLY its own task count so admins
                // know exactly which page to open (leads vs normal customers vs contract).
                const segmentCount =
                  item.path === "/admin/leads" ? tasksByCategory.lead
                  : item.path === "/admin/customers" ? tasksByCategory.customer
                  : item.path === "/admin/contract-customers" ? tasksByCategory.contract
                  : 0;
                const segmentLabel =
                  item.path === "/admin/leads" ? (t("admin.customers.lead") || "Leads")
                  : item.path === "/admin/customers" ? (t("admin.customers.customer") || "Customers")
                  : item.path === "/admin/contract-customers" ? (t("admin.customers.contract") || "Contract")
                  : "";
                const badge = item.path === "/admin/chat" ? unreadCount : segmentCount;
                const badgeTitle = segmentCount > 0 ? `${segmentLabel}: ${segmentCount} task${segmentCount > 1 ? "s" : ""} due soon` : undefined;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={collapsed && !isMobile ? t(item.labelKey) : badgeTitle}
                    onClick={isMobile ? () => setMobileNav(false) : undefined}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                      active
                        ? "bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    } ${collapsed && !isMobile ? "justify-center px-2" : ""}`}
                  >
                    <div className={`relative flex-shrink-0`}>
                      {active && (
                        <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-sidebar-primary" />
                      )}
                      <item.icon className={`h-[18px] w-[18px] transition-transform duration-150 ${
                        collapsed && !isMobile ? "group-hover:scale-110" : ""
                      }`} />
                      {badge > 0 && collapsed && !isMobile && (
                        <span
                          aria-label={badgeTitle ?? `${badge}`}
                          className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-black px-1 animate-in zoom-in"
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    {(!collapsed || isMobile) && (
                      <span className="flex flex-1 items-center gap-2">
                        <span className="flex-1 truncate">{t(item.labelKey)}</span>
                        {badge > 0 && (
                          <span
                            title={badgeTitle}
                            className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-black px-1 animate-in zoom-in"
                          >
                            {badge}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom section — user + back to store */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {(!collapsed || isMobile) ? (
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent/40">
              <div className="admin-avatar w-8 h-8 text-[11px]" style={{ background: 'hsl(var(--sidebar-primary) / 0.2)', color: 'hsl(var(--sidebar-primary))', borderColor: 'hsl(var(--sidebar-primary) / 0.3)' }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize">{displayRole}</p>
              </div>
            </div>
          ) : (
            <div className="admin-avatar w-8 h-8 text-[11px] mx-auto" style={{ background: 'hsl(var(--sidebar-primary) / 0.2)', color: 'hsl(var(--sidebar-primary))', borderColor: 'hsl(var(--sidebar-primary) / 0.3)' }} title={displayName}>
              {initials}
            </div>
          )}
          <Link
            to="/"
            className={`flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/40 ${
              collapsed && !isMobile ? "justify-center" : ""
            }`}
          >
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span>{t("admin.back_to_store")}</span>}
          </Link>
          <button
            onClick={() => logout()}
            title={t("admin.sign_out")}
            className={`w-full flex items-center gap-2 text-xs text-destructive/70 hover:text-destructive transition-colors px-2 py-1.5 rounded-lg hover:bg-destructive/10 ${
              collapsed && !isMobile ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span>{t("admin.sign_out")}</span>}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile nav overlay */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl">
            <NavContent isMobile />
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex bg-sidebar text-sidebar-foreground flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border/30 ${collapsed ? "w-[68px]" : "w-64"}`}>
        <NavContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 md:h-16 bg-card border-b border-border flex items-center px-4 md:px-6 gap-4 sticky top-0 z-30">
          <button onClick={() => setMobileNav(true)} className="md:hidden text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground hidden sm:inline">{t(getGreetingKey())}</span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <h2 className="font-display font-bold text-base md:text-lg truncate">{currentPage ? t(currentPage.labelKey) : t("admin.dashboard")}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Globe className="h-4 w-4" />
                <FlagIcon country={localeFlag(lang)} className="w-5 h-3.5 rounded-[2px] overflow-hidden" />
                <span className="hidden sm:inline text-xs font-bold uppercase">{lang}</span>
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl p-1.5 min-w-[150px] z-50 animate-in fade-in slide-in-from-top-2">
                    {supportedLocales.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => { setLang(loc); setLangOpen(false); }}
                        className={`flex items-center gap-3 w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          lang === loc ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                        }`}
                      >
                        <FlagIcon country={localeFlag(loc)} className="w-5 h-3.5 rounded-[2px]" />
                        {localeLabel(loc)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <AdminGlobalSearch />
          </div>
        </header>

        {/* Main — page-enter animation + scrollbar */}
        <main className="flex-1 p-4 md:p-6 overflow-auto admin-scroll admin-page-enter">
          <Outlet />
        </main>
        {/* Admin-only task reminders — mounted inside AdminLayout so it never renders on public pages */}
        <TaskReminderModal />
      </div>
    </div>
  );
}
