import React from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingBag, Users, Tag, FileText, Inbox, Plus } from "lucide-react";

const defaultIcons: Record<string, React.ElementType> = {
  products: Package,
  orders: ShoppingBag,
  customers: Users,
  discounts: Tag,
  inventory: Package,
  applications: FileText,
  default: Inbox,
};

interface AdminEmptyStateProps {
  /** Resource name like "products", "orders", etc. */
  resource?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Icon override */
  icon?: React.ElementType;
  /** CTA button text */
  actionLabel?: string;
  /** CTA link */
  actionHref?: string;
  /** CTA click handler (if no link) */
  onAction?: () => void;
}

export function AdminEmptyState({
  resource = "default",
  title,
  description,
  icon,
  actionLabel,
  actionHref,
  onAction,
}: AdminEmptyStateProps) {
  const Icon = icon || defaultIcons[resource] || defaultIcons.default;
  const displayTitle = title || `No ${resource} found`;
  const displayDescription =
    description ||
    `There are no ${resource} to display yet. Get started by adding your first one.`;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Decorative circles */}
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-accent/5 animate-pulse" />
        <div className="absolute -inset-2 rounded-full bg-accent/8" />
        <div className="relative w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Icon className="h-8 w-8 text-accent" strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="font-display font-bold text-lg text-foreground mb-2 text-center">
        {displayTitle}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
        {displayDescription}
      </p>

      {(actionLabel && actionHref) && (
        <Link to={actionHref} className="admin-btn--primary text-sm gap-2">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Link>
      )}
      {(actionLabel && onAction && !actionHref) && (
        <button onClick={onAction} className="admin-btn--primary text-sm gap-2">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
