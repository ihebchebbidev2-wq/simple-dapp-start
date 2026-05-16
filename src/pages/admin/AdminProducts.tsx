import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Edit, Trash2, Copy, Eye, X, ChevronDown, ChevronUp, ClipboardList, Download, Loader2, AlertCircle } from "lucide-react";
import { useProducts, useCategories, useApiMutation } from "@/hooks/useApi";
import { api, unwrapApiList, unwrapPagination, Product, ProductCategory, resolveUploadImageUrl } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

function productListThumb(product: any): string | null {
  const images = product.images || [];
  const primary = images.find((img: any) => img.is_primary)?.image_url || images[0]?.image_url;
  const raw = primary || product.image || product.image_url;
  if (!raw) return null;
  return resolveUploadImageUrl(String(raw));
}
import { useQueryClient } from "@tanstack/react-query";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminDataTable, DataColumn } from "@/components/admin/AdminDataTable";
import { useDebouncedSearch, useUrlFilter } from "@/hooks/useDebouncedSearch";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

const statusStyles: Record<string, string> = {
  active: "badge-success",
  draft: "badge-warning",
  archived: "badge-destructive",
};

export default function AdminProducts() {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  function toNumber(v: unknown): number {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  const [page, setPage] = useState(1);
  const { inputValue: search, debouncedValue: debouncedSearch, setInputValue: setSearch, clear: clearSearch } = useDebouncedSearch({ delay: 300 });
  const [categoryFilter, setCategoryFilter] = useUrlFilter("cat");
  const [statusFilter, setStatusFilter] = useUrlFilter("status");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data: productsResponse, isLoading, isError, error } = useProducts(page, 50);
  const { data: categoriesResponse } = useCategories();

  const deleteProductMutation = useApiMutation(
    (id: string) => api.deleteProduct(id),
    {
      onSuccess: () => {
        showSuccessToast("Products", "Product deleted successfully");
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setSelectedProducts(new Set());
      },
      onError: (e: unknown) => {
        showErrorToast("Products", e instanceof Error ? e.message : "Delete failed");
      },
    }
  );

  const updateProductMutation = useApiMutation(
    ({ id, data }: { id: string; data: any }) => api.updateProduct(id, data),
    {
      onSuccess: () => {
        showSuccessToast("Products", "Product updated successfully");
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
      onError: (e: unknown) => {
        showErrorToast("Products", e instanceof Error ? e.message : "Update failed");
      },
    }
  );

  const products = unwrapApiList<Product>(productsResponse, []);
  const categories: ProductCategory[] = unwrapApiList<ProductCategory>(categoriesResponse, []);
  const pagination = unwrapPagination(productsResponse);

  const filtered = products.filter((p: Product) => {
    const s = debouncedSearch.toLowerCase();
    const matchesSearch = !s ||
      p.name.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s);
    const matchesCat = !categoryFilter || p.category_id === categoryFilter || p.category === categoryFilter;
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  function handleBulkStatusChange(status: string) {
    selectedProducts.forEach(id => {
      updateProductMutation.mutate({ id, data: { status } });
    });
    setSelectedProducts(new Set());
  }

  async function handleBulkDelete() {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_products_bulk"), variant: "danger" });
    if (ok) {
      selectedProducts.forEach(id => {
        deleteProductMutation.mutate(id);
      });
    }
  }

  async function handleDeleteProduct(id: string) {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_product"), variant: "danger" });
    if (ok) deleteProductMutation.mutate(id);
  }

  function exportCSV() {
    const rows = filtered.map((p: Product) =>
      `${p.sku},"${p.name}",${p.category || ""},${p.price},${p.wholesale_price || ""},${p.stock_quantity},${p.status}`
    );
    const csv = `SKU,Name,Category,Price,Wholesale,Stock,Status\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "products.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return <AdminPageLoading message="Loading products" />;
  }

  if (isError) {
    return (
      <AdminPageError
        message={error instanceof Error ? error.message : "An error occurred while fetching products."}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
      />
    );
  }

  // Column definitions for DataTable
  const columns: DataColumn<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (p) => p.name.toLowerCase(),
      render: (p) => {
        const thumb = productListThumb(p);
        return (
          <div className="flex items-center gap-3">
            {thumb ? (
              <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover bg-secondary shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-secondary border border-border" aria-hidden />
            )}
            <span className="font-medium truncate max-w-[200px]">{p.name}</span>
          </div>
        );
      },
    },
    {
      key: "sku",
      header: "SKU",
      hideMobile: true,
      sortValue: (p) => p.sku,
      render: (p) => <span className="text-muted-foreground font-mono text-xs">{p.sku}</span>,
    },
    {
      key: "category",
      header: "Category",
      hideMobile: true,
      sortValue: (p) => p.category || "",
      render: (p) => <span className="text-sm">{p.category || "Uncategorized"}</span>,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortValue: (p) => toNumber(p.price),
      render: (p) => <span className="font-semibold">C${toNumber(p.price).toFixed(2)}</span>,
    },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      hideMobile: true,
      toggleable: true,
      sortValue: (p) => toNumber((p as any).discount_percent),
      render: (p) => {
        const d = toNumber((p as any).discount_percent);
        return d > 0
          ? <span className="text-destructive font-bold">-{d}%</span>
          : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "wholesale",
      header: "Wholesale",
      align: "right",
      hideMobile: true,
      toggleable: true,
      sortValue: (p) => toNumber(p.wholesale_price ?? p.price),
      render: (p) => <span className="text-muted-foreground">C${toNumber(p.wholesale_price ?? p.price).toFixed(2)}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      sortValue: (p) => p.stock_quantity,
      render: (p) => {
        const isLow = p.stock_quantity <= (p.minimum_stock || 0);
        return <span className={isLow ? "text-destructive font-bold" : "font-semibold"}>{p.stock_quantity}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      sortValue: (p) => p.status,
      render: (p) => <span className={statusStyles[p.status]}>{p.status}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      toggleable: false,
      render: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link to={`/admin/products/${p.id}/view`} className="admin-btn--ghost p-1.5" title="View"><Eye className="h-4 w-4" /></Link>
          <Link to={`/admin/products/${p.id}/logs`} className="admin-btn--ghost p-1.5" title="Stock Logs"><ClipboardList className="h-4 w-4" /></Link>
          <Link to={`/admin/products/${p.id}`} className="admin-btn--ghost p-1.5" title="Edit"><Edit className="h-4 w-4" /></Link>
          <button
            onClick={() => handleDeleteProduct(p.id)}
            disabled={deleteProductMutation.isPending}
            className="admin-btn--danger p-1.5 border-0"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const hasFilters = !!debouncedSearch || !!categoryFilter || !!statusFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Products"
          subtitle={pagination ? `${pagination.total} total products` : undefined}
        />
        <div className="flex items-center gap-2">
          <Link to="/admin/products/new" className="admin-btn--primary text-xs md:text-sm">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>

      <div className="dashboard-card">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="relative flex-1 w-full min-w-0 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className="admin-input pl-10"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="admin-input flex-1 sm:flex-none">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-input flex-1 sm:flex-none">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {hasFilters && (
            <button onClick={() => { clearSearch(); setCategoryFilter(""); setStatusFilter(""); }} className="text-xs text-accent hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <AdminEmptyState
              resource="products"
              title={hasFilters ? "No matching products" : "No products yet"}
              description={hasFilters ? "Try adjusting your search or filters." : "Get started by adding your first product."}
              actionLabel={hasFilters ? undefined : "Add Product"}
              actionHref={hasFilters ? undefined : "/admin/products/new"}
            />
          ) : (
            filtered.map((product: Product) => {
              const isExpanded = expandedProduct === product.id;
              const thumb = productListThumb(product);
              const isLowStock = product.stock_quantity <= (product.minimum_stock || 0);
              return (
                <div key={product.id} className={`border border-border rounded-xl overflow-hidden ${isLowStock ? 'bg-destructive/5' : ''}`}>
                  <button onClick={() => setExpandedProduct(isExpanded ? null : product.id)} className="w-full p-3 text-left flex items-center gap-3 hover:bg-muted/20 transition-colors">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover bg-secondary flex-shrink-0 shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-secondary flex-shrink-0 border border-border" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">{product.sku}</span>
                        <span className={statusStyles[product.status]}>{product.status}</span>
                        {toNumber(product.discount_percent) > 0 && (
                          <span className="text-[9px] font-black text-destructive bg-destructive/10 px-1.5 py-0.5 rounded uppercase tracking-wider">-{toNumber(product.discount_percent)}%</span>
                        )}
                      </div>
                      <p className="text-sm font-bold mt-0.5">C${toNumber(product.price).toFixed(2)}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-border pt-3 bg-muted/10 space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Category</span><span className="font-medium">{product.category || "Uncategorized"}</span></div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Wholesale</span>
                        <span className="font-medium">C${toNumber(product.wholesale_price ?? product.price).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Stock</span>
                        <span className={`font-medium ${isLowStock ? "text-destructive font-bold" : ""}`}>
                          {product.stock_quantity}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Link to={`/admin/products/${product.id}/view`} className="admin-btn--secondary flex-1 text-xs py-1.5"><Eye className="h-3 w-3" /> View</Link>
                        <Link to={`/admin/products/${product.id}/logs`} className="admin-btn--secondary flex-1 text-xs py-1.5"><ClipboardList className="h-3 w-3" /> Logs</Link>
                        <Link to={`/admin/products/${product.id}`} className="admin-btn--primary flex-1 text-xs py-1.5"><Edit className="h-3 w-3" /> Edit</Link>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={deleteProductMutation.isPending}
                          className="admin-btn--danger px-3 py-1.5 text-xs"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop DataTable */}
        <div className="hidden md:block">
          <AdminDataTable
            data={filtered}
            columns={columns}
            rowKey={(p) => p.id}
            selectable
            selectedIds={selectedProducts}
            onSelectionChange={setSelectedProducts}
            label="Products"
            onExport={exportCSV}
            bulkActions={
              <>
                <button
                  onClick={() => handleBulkStatusChange("active")}
                  disabled={updateProductMutation.isPending}
                  className="admin-btn--secondary text-xs py-1.5"
                >
                  Set Active
                </button>
                <button
                  onClick={() => handleBulkStatusChange("draft")}
                  disabled={updateProductMutation.isPending}
                  className="admin-btn--secondary text-xs py-1.5"
                >
                  Set Draft
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleteProductMutation.isPending}
                  className="admin-btn--danger text-xs py-1.5"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </>
            }
            onRowClick={(p) => window.location.href = `/admin/products/${p.id}/view`}
            rowClassName={(p) => p.stock_quantity <= (p.minimum_stock || 0) ? "bg-destructive/5" : ""}
            emptyState={{
              resource: "products",
              title: hasFilters ? "No matching products" : "No products yet",
              description: hasFilters ? "Try adjusting your search or filters." : "Get started by adding your first product to your catalog.",
              actionLabel: hasFilters ? undefined : "Add Product",
              actionHref: hasFilters ? undefined : "/admin/products/new",
            }}
            pagination={pagination && Number(pagination.pages ?? 0) > 1 ? {
              page,
              totalPages: Number(pagination.pages),
              total: Number(pagination.total ?? products.length),
              onPageChange: setPage,
            } : undefined}
          />
        </div>

        {/* Mobile pagination */}
        {pagination && Number(pagination.pages ?? 0) > 1 && (
          <div className="md:hidden flex items-center justify-between mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
            <span className="text-xs font-medium">Page {page} of {Number(pagination.pages)}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="admin-btn--secondary text-xs px-3 py-1"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(Number(pagination.pages), p + 1))}
                disabled={page === Number(pagination.pages)}
                className="admin-btn--secondary text-xs px-3 py-1"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
