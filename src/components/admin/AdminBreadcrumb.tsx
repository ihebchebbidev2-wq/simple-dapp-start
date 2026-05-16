import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Map route segments to human-readable labels */
const segmentLabels: Record<string, string> = {
  admin: "Admin",
  products: "Products",
  categories: "Categories",
  inventory: "Inventory",
  orders: "Orders",
  offers: "Offers",
  carts: "Abandoned Carts",
  customers: "Customers",
  applications: "Applications",
  discounts: "Discounts",
  "tax-rates": "Tax Rates",
  landing: "Landing Page",
  cms: "CMS",
  seo: "SEO",
  users: "Users",
  "admin-contacts": "Admin Contacts",
  access: "Access Control",
  chat: "Chat Inbox",
  settings: "Settings",
  docs: "Documentation",
  analytics: "Analytics",
  new: "New",
  edit: "Edit",
  view: "View",
  logs: "Logs",
};

interface AdminBreadcrumbProps {
  /** Override the auto-detected page title */
  overrideTitle?: string;
  /** Extra breadcrumb segments to append */
  extraSegments?: { label: string; path?: string }[];
}

export function AdminBreadcrumb({ overrideTitle, extraSegments }: AdminBreadcrumbProps) {
  const location = useLocation();
  const { t } = useLanguage();

  const pathSegments = location.pathname
    .replace(/^\/admin\/?/, "")
    .split("/")
    .filter(Boolean);

  // Build breadcrumb items
  const crumbs: { label: string; path: string }[] = [
    { label: "Dashboard", path: "/admin" },
  ];

  let currentPath = "/admin";
  pathSegments.forEach((segment, i) => {
    currentPath += `/${segment}`;
    const isUuid = /^[0-9a-f-]{8,}$/i.test(segment);
    const label = isUuid
      ? `#${segment.slice(0, 8)}`
      : segmentLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, path: currentPath });
  });

  // Override the last crumb label
  if (overrideTitle && crumbs.length > 1) {
    crumbs[crumbs.length - 1].label = overrideTitle;
  }

  // Append extra segments
  if (extraSegments) {
    extraSegments.forEach((seg) => {
      crumbs.push({ label: seg.label, path: seg.path || currentPath });
    });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-2 overflow-x-auto">
      <Link
        to="/admin"
        className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
      >
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.slice(1).map((crumb, i) => {
        const isLast = i === crumbs.length - 2;
        return (
          <React.Fragment key={crumb.path + i}>
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            {isLast ? (
              <span className="font-semibold text-foreground/80 truncate max-w-[200px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
