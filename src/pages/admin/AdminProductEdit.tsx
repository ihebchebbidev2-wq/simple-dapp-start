import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, Plus, GripVertical, Eye, Loader2, AlertCircle, Star, ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import { useProduct, useAdminCategoriesList } from "@/hooks/useApi";
import { api, unwrapApiList, resolveUploadImageUrl, type ProductCategory } from "@/lib/api";
import { productDetailHref } from "@/lib/storefront-product";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

type ProductStatus = "active" | "draft" | "archived";

type ProductEditForm = {
  id?: string;
  name: string;
  sku: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  description: string;
  specifications: Record<string, unknown>;
  price: number;
  wholesalePrice: number;
  discountPercent: number;
  stock: number;
  minimumStock: number;
  status: ProductStatus;
  weightLbs: number;
  compatibility: string[];
};

type ApiImageRow = {
  id: string;
  image_url: string;
  alt_text?: string;
  is_primary?: number | boolean;
};

type SpecRow = {
  id: string;
  key: string;
  value: string;
};

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function emptyForm(categories: ProductCategory[]): ProductEditForm {
  const first = categories[0];
  return {
    name: "",
    sku: "",
    slug: "",
    categoryId: first?.id ?? "",
    categoryName: first?.name ?? "",
    categorySlug: first?.slug ?? "",
    description: "",
    specifications: {},
    price: 0,
    wholesalePrice: 0,
    discountPercent: 0,
    stock: 0,
    minimumStock: 0,
    status: "draft",
    weightLbs: 0,
    compatibility: [],
  };
}

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapApiToForm(p: Record<string, unknown>, categories: ProductCategory[]): ProductEditForm {
  const details =
    p.details && typeof p.details === "object" && !Array.isArray(p.details)
      ? (p.details as Record<string, unknown>)
      : {};
  const specs =
    details.specifications && typeof details.specifications === "object" && !Array.isArray(details.specifications)
      ? (details.specifications as Record<string, unknown>)
      : {};
  const compat = Array.isArray(details.compatibility) ? details.compatibility.map(String) : [];
  const cid = String(p.category_id ?? "");
  const cat = categories.find((c) => c.id === cid);
  const isActive = p.is_active === 1 || p.is_active === true;
  const slugFromDetails = details.slug != null ? String(details.slug) : "";
  const adminStatus = details.adminStatus;
  let status: ProductStatus =
    adminStatus === "active" || adminStatus === "draft" || adminStatus === "archived"
      ? (adminStatus as ProductStatus)
      : isActive
        ? "active"
        : "draft";

  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    sku: String(p.sku ?? ""),
    slug: slugFromDetails || generateSlug(String(p.name ?? "")),
    categoryId: cid,
    categoryName: cat?.name ?? String(p.category ?? ""),
    categorySlug: cat?.slug ?? String(p.categorySlug ?? ""),
    description: String(p.description ?? ""),
    specifications: specs,
    price: Number(p.base_price ?? p.price ?? 0),
    wholesalePrice: Number(p.cost_price ?? p.wholesale_price ?? 0),
    discountPercent: Number(p.discount_percent ?? 0),
    stock: Math.max(0, Number(p.stock ?? p.stock_quantity ?? 0)),
    minimumStock: Math.max(0, Number(p.minimum_stock ?? 0)),
    status,
    weightLbs: Number(details.weightLbs ?? 0),
    compatibility: compat,
  };
}

function specsObjectToRows(specs: Record<string, unknown>): SpecRow[] {
  const rows = Object.entries(specs || {}).map(([k, v], i) => ({
    id: `spec-${i}-${k}`,
    key: String(k),
    value: Array.isArray(v) ? v.map(String).join(", ") : String(v ?? ""),
  }));
  return rows.length > 0 ? rows : [{ id: "spec-empty-0", key: "", value: "" }];
}

function specsRowsToObject(rows: SpecRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    out[key] = row.value.trim();
  }
  return out;
}

// =====================================================================
// Per-Customer Product Price Augmentation sub-component
// =====================================================================
type CustomerPrice = {
  id: string;
  customer_id: string;
  product_id: string;
  augmentation_percent: number;
  company_name: string;
  contact_person: string;
  email: string;
};

function CustomerProductPrices({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const confirmAction = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [augPercent, setAugPercent] = useState(0);
  const [allCustomers, setAllCustomers] = useState<{ id: string; company_name: string; email: string }[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  const { data: cpData, isLoading } = useQuery({
    queryKey: ["product-customer-prices", productId],
    queryFn: () => api.getProductCustomerPrices(productId),
    enabled: !!productId,
  });

  const prices: CustomerPrice[] = Array.isArray(cpData?.data) ? (cpData!.data as unknown as CustomerPrice[]) : [];

  // Load all customers when the add panel opens
  useEffect(() => {
    if (!showAdd) return;
    let cancelled = false;
    (async () => {
      setLoadingAll(true);
      try {
        const res: any = await (api as any).request('GET', `/customers?limit=200`);
        const raw = res?.data;
        const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.items) ? raw.items : [];
        if (!cancelled) {
          setAllCustomers(
            (rows as any[]).map((c: any) => ({ id: c.id, company_name: c.company_name || c.contact_person || '', email: c.email || '' }))
          );
        }
      } catch {
        if (!cancelled) setAllCustomers([]);
      }
      if (!cancelled) setLoadingAll(false);
    })();
    return () => { cancelled = true; };
  }, [showAdd]);

  // Filtered list based on search
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter(
      (c) => c.company_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [customerSearch, allCustomers]);

  const saveMut = useMutation({
    mutationFn: () => api.setProductCustomerPrice(productId, selectedCustomerId, augPercent),
    onSuccess: () => {
      showSuccessToast("Customer price saved");
      queryClient.invalidateQueries({ queryKey: ["product-customer-prices", productId] });
      setShowAdd(false);
      setSelectedCustomerId("");
      setCustomerSearch("");
      setAugPercent(0);
    },
    onError: (e: unknown) => showErrorToast(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (cpId: string) => api.deleteProductCustomerPrice(productId, cpId),
    onSuccess: () => {
      showSuccessToast("Customer price removed");
      queryClient.invalidateQueries({ queryKey: ["product-customer-prices", productId] });
    },
    onError: (e: unknown) => showErrorToast(e instanceof Error ? e.message : "Delete failed"),
  });

  async function handleDelete(cpId: string) {
    const ok = await confirmAction({ title: "Remove customer price", message: "Remove this per-customer price augmentation?", variant: "danger" });
    if (ok) deleteMut.mutate(cpId);
  }

  return (
    <div className="dashboard-card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-1.5">
          <Users className="h-4 w-4" /> Customer Prices
        </h3>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="px-2.5 py-1.5 rounded-sm border border-border text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {showAdd && (
        <div className="border border-border rounded-sm p-3 space-y-3 bg-secondary/20">
          <div>
            <label className="block text-xs font-medium mb-1">Select Customer</label>
            {/* Native select for quick pick */}
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedCustomerId(id);
                const found = allCustomers.find((c) => c.id === id);
                if (found) setCustomerSearch(found.company_name + " (" + found.email + ")");
              }}
              className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent mb-2"
            >
              <option value="">— Choose a customer —</option>
              {allCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} — {c.email}
                </option>
              ))}
            </select>
            {loadingAll && <p className="text-xs text-muted-foreground">Loading customers...</p>}

            {/* Search filter for large lists */}
            <label className="block text-xs font-medium mb-1 mt-2">Or search to filter</label>
            <input
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(""); }}
              className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              placeholder="Type company name or email to filter..."
            />
            {filteredCustomers.length > 0 && !selectedCustomerId && customerSearch.trim().length > 0 && (
              <div className="mt-1 border border-border rounded-sm bg-background max-h-48 overflow-y-auto divide-y divide-border">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.company_name + " (" + c.email + ")"); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                  >
                    <span className="font-medium">{c.company_name}</span>{" "}
                    <span className="text-muted-foreground text-xs">{c.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Augmentation (%)</label>
            <input
              type="number"
              step="0.01"
              min="-100"
              max="500"
              value={augPercent}
              onChange={(e) => setAugPercent(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-muted-foreground mt-1">Positive = markup, negative = discount. Overrides the general augmentation for this product.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!selectedCustomerId || saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="btn-accent px-3 py-1.5 rounded-sm text-xs font-medium disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-sm text-xs border border-border hover:bg-secondary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : prices.length === 0 ? (
        <p className="text-xs text-muted-foreground">No per-customer prices set. All customers use their general augmentation.</p>
      ) : (
        <div className="border border-border rounded-sm text-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
            <span>Customer</span>
            <span className="text-right">Augmentation</span>
            <span></span>
          </div>
          <div className="divide-y divide-border">
            {prices.map((cp) => (
              <div key={cp.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2">
                <div className="min-w-0">
                  <span className="font-medium block truncate">{cp.company_name || cp.contact_person}</span>
                  <span className="text-muted-foreground text-xs block truncate">{cp.email}</span>
                </div>
                <span className={`font-mono text-xs font-bold whitespace-nowrap ${Number(cp.augmentation_percent) >= 0 ? "text-accent" : "text-destructive"}`}>
                  {Number(cp.augmentation_percent) >= 0 ? "+" : ""}{cp.augmentation_percent}%
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(cp.id)}
                  disabled={deleteMut.isPending}
                  className="p-1 rounded-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminProductEdit() {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const { productId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNew = !productId || productId === "new";
  const effectiveId = isNew ? "" : productId!;

  const { data: productResponse, isLoading: productLoading, isError: productError } = useProduct(effectiveId);
  const {
    data: categoriesResponse,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useAdminCategoriesList();

  const categories = unwrapApiList<ProductCategory>(categoriesResponse, []);
  const raw = productResponse?.data as unknown as Record<string, unknown> | undefined;

  const [form, setForm] = useState<ProductEditForm>(() => emptyForm([]));
  const [specRows, setSpecRows] = useState<SpecRow[]>([{ id: "spec-empty-0", key: "", value: "" }]);
  const [compatInput, setCompatInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const initRef = useRef(false);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  useEffect(() => {
    initRef.current = false;
  }, [effectiveId]);

  useEffect(() => {
    if (!isNew || categories.length === 0) return;
    setForm((prev) => {
      if (prev.categoryId) return prev;
      const first = categories[0];
      return { ...prev, categoryId: first.id, categoryName: first.name, categorySlug: first.slug };
    });
  }, [isNew, categories]);

  useEffect(() => {
    if (isNew || !raw || initRef.current) return;
    const next = mapApiToForm(raw, categories);
    setForm(next);
    setSpecRows(specsObjectToRows(next.specifications || {}));
    initRef.current = true;
  }, [isNew, raw, categories]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      for (const img of pendingImagesRef.current) {
        URL.revokeObjectURL(img.previewUrl);
      }
    };
  }, []);

  function updateField<K extends keyof ProductEditForm>(field: K, value: ProductEditForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCategoryChange(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) {
      setForm((prev) => ({
        ...prev,
        categoryId: cat.id,
        categoryName: cat.name,
        categorySlug: cat.slug,
      }));
    }
  }

  function handleSpecRowChange(id: string, patch: Partial<SpecRow>) {
    setSpecRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addSpecRow() {
    setSpecRows((prev) => [...prev, { id: `spec-${Date.now()}-${Math.random()}`, key: "", value: "" }]);
  }

  function removeSpecRow(id: string) {
    setSpecRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length > 0 ? next : [{ id: "spec-empty-0", key: "", value: "" }];
    });
  }

  function addCompatibilityChip() {
    const value = compatInput.trim();
    if (!value) return;
    setForm((prev) => {
      if (prev.compatibility.includes(value)) return prev;
      return { ...prev, compatibility: [...prev.compatibility, value] };
    });
    setCompatInput("");
  }

  function removeCompatibilityChip(value: string) {
    setForm((prev) => ({ ...prev, compatibility: prev.compatibility.filter((v) => v !== value) }));
  }

  const detailsPayload = () => ({
    specifications: form.specifications,
    compatibility: form.compatibility,
    slug: form.slug.trim() || generateSlug(form.name),
    weightLbs: form.weightLbs,
    adminStatus: form.status,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.sku.trim()) throw new Error("SKU is required.");
      if (!form.name.trim()) throw new Error("Product name is required.");
      if (!form.categoryId) throw new Error("Category is required.");

      const base = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId,
        basePrice: form.price,
        costPrice: form.wholesalePrice,
        discount_percent: form.discountPercent,
        description: form.description,
        details: { ...detailsPayload(), specifications: specsRowsToObject(specRows) },
        status: form.status,
        stock: form.stock,
        stock_quantity: form.stock,
        minimum_stock: form.minimumStock,
        initialStock: form.stock,
      };

      if (isNew) {
        const created = await api.createProduct(base);
        const createdId =
          created?.data && typeof created.data === "object" && created.data !== null && "id" in created.data
            ? String((created.data as { id: string }).id)
            : "";
        if (!createdId) return created;

        if (pendingImages.length > 0) {
          for (const img of pendingImages) {
            await api.uploadProductImage(createdId, img.file);
          }
        }
        return created;
      }
      return api.updateProduct(effectiveId, base);
    },
    onSuccess: (res) => {
      showSuccessToast(isNew ? "Product created" : "Product saved");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (isNew && res?.data && typeof res.data === "object" && res.data !== null && "id" in res.data) {
        const newId = String((res.data as { id: string }).id);
        setPendingImages((prev) => {
          for (const img of prev) URL.revokeObjectURL(img.previewUrl);
          return [];
        });
        navigate(`/admin/products/${newId}`);
        queryClient.invalidateQueries({ queryKey: ["product", newId] });
      } else if (!isNew && effectiveId) {
        queryClient.invalidateQueries({ queryKey: ["product", effectiveId] });
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Save failed";
      showErrorToast(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProduct(effectiveId),
    onSuccess: () => {
      showSuccessToast("Product deleted");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/admin/products");
    },
    onError: (e: unknown) => {
      showErrorToast(e instanceof Error ? e.message : "Delete failed");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadProductImage(effectiveId, file),
    onSuccess: () => {
      showSuccessToast("Image uploaded");
      queryClient.invalidateQueries({ queryKey: ["product", effectiveId] });
    },
    onError: (e: unknown) => {
      showErrorToast(e instanceof Error ? e.message : "Upload failed");
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => api.deleteProductImage(effectiveId, imageId),
    onSuccess: () => {
      showSuccessToast("Image removed");
      queryClient.invalidateQueries({ queryKey: ["product", effectiveId] });
    },
    onError: (e: unknown) => {
      showErrorToast(e instanceof Error ? e.message : "Could not remove image");
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (imageId: string) => api.updateProductImage(effectiveId, imageId, { isPrimary: true }),
    onSuccess: () => {
      showSuccessToast("Primary image updated");
      queryClient.invalidateQueries({ queryKey: ["product", effectiveId] });
    },
    onError: (e: unknown) => {
      showErrorToast(e instanceof Error ? e.message : "Could not set primary image");
    },
  });

  const reorderImageMutation = useMutation({
    mutationFn: async ({ imageId, newOrder }: { imageId: string; newOrder: number }) => {
      return api.updateProductImage(effectiveId, imageId, { displayOrder: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", effectiveId] });
    },
    onError: (e: unknown) => {
      showErrorToast(e instanceof Error ? e.message : "Could not reorder image");
    },
  });

  function handleSave() {
    saveMutation.mutate();
  }

  function handlePickImage() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (isNew) {
      setPendingImages((prev) => [
        ...prev,
        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
      return;
    }
    uploadMutation.mutate(files[0]);
  }

  function handleRemovePendingImage(id: string) {
    setPendingImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleDeleteProduct() {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_product"), variant: "danger" });
    if (!ok) return;
    deleteMutation.mutate();
  }

  async function handleDeleteImage(imageId: string) {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_image"), variant: "danger" });
    if (!ok) return;
    deleteImageMutation.mutate(imageId);
  }

  const images: ApiImageRow[] = Array.isArray(raw?.images)
    ? (raw!.images as ApiImageRow[]).filter((img) => img?.id && img?.image_url)
    : [];

  async function handleSetPrimary(imageId: string) {
    setPrimaryMutation.mutate(imageId);
  }

  async function handleMoveImage(imageId: string, direction: "left" | "right") {
    const idx = images.findIndex((img) => img.id === imageId);
    if (idx < 0) return;
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= images.length) return;
    // Swap display orders
    await api.updateProductImage(effectiveId, images[idx].id, { displayOrder: swapIdx });
    await api.updateProductImage(effectiveId, images[swapIdx].id, { displayOrder: idx });
    queryClient.invalidateQueries({ queryKey: ["product", effectiveId] });
  }

  if (!isNew && productLoading) {
    return <AdminPageLoading message="Loading product" />;
  }

  if (!isNew && productError) {
    return (
      <AdminPageError
        message="Could not load this product."
        extra={
          <Link to="/admin/products" className="text-accent hover:underline text-sm">
            ← Back to products
          </Link>
        }
      />
    );
  }

  const busy =
    saveMutation.isPending || deleteMutation.isPending || uploadMutation.isPending || deleteImageMutation.isPending || setPrimaryMutation.isPending || reorderImageMutation.isPending;

  return (
    <div className="space-y-6 w-full max-w-7xl">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={isNew}
        className="hidden"
        onChange={onFileChange}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/products" className="p-1.5 hover:bg-secondary rounded-sm transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="font-display font-bold text-lg md:text-xl">
            {isNew ? "Create Product" : `Edit: ${form.name || "Product"}`}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isNew && (
            <>
              <Link
                to={`/product/${encodeURIComponent(effectiveId)}`}
                className="px-3 py-2 rounded-sm text-xs font-medium border border-border hover:bg-secondary transition-colors flex items-center gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </Link>
              <Link
                to={`/admin/products/${effectiveId}/logs`}
                className="px-3 py-2 rounded-sm text-xs font-medium border border-border hover:bg-secondary transition-colors"
              >
                Logs
              </Link>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={busy}
                className="px-3 py-2 rounded-sm text-xs font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Basic Information</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input
                value={form.name}
                onChange={(e) => {
                  updateField("name", e.target.value);
                  if (isNew) updateField("slug", generateSlug(e.target.value));
                }}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g. Air Spring W01-358 9781"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">SKU</label>
                <input
                  value={form.sku}
                  onChange={(e) => updateField("sku", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. 1T15ZR-6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                  placeholder="air-spring-w01-358-9781"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent resize-y"
                placeholder="Product description..."
              />
            </div>
          </div>

          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Vehicle Compatibility</h3>
            <div className="flex gap-2">
              <input
                value={compatInput}
                onChange={(e) => setCompatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCompatibilityChip();
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                placeholder="Type vehicle model and press Enter"
              />
              <button
                type="button"
                onClick={addCompatibilityChip}
                className="px-3 py-2 rounded-sm border border-border text-sm hover:bg-secondary transition-colors"
              >
                Add
              </button>
            </div>
            {(form.compatibility || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(form.compatibility || []).map((v, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => removeCompatibilityChip(v)}
                    className="badge-info text-xs hover:opacity-80 transition-opacity"
                    title="Remove"
                  >
                    {v} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Specifications</h3>
              <button
                type="button"
                onClick={addSpecRow}
                className="px-2.5 py-1.5 rounded-sm border border-border text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </button>
            </div>
            <div className="border border-border rounded-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto] bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="px-3 py-2 border-r border-border">Specification</div>
                <div className="px-3 py-2 border-r border-border">Value</div>
                <div className="px-3 py-2">Actions</div>
              </div>
              <div className="divide-y divide-border">
                {specRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_auto]">
                    <div className="p-2 border-r border-border">
                      <input
                        value={row.key}
                        onChange={(e) => handleSpecRowChange(row.id, { key: e.target.value })}
                        className="w-full px-2.5 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                        placeholder="e.g. Part Number"
                      />
                    </div>
                    <div className="p-2 border-r border-border">
                      <input
                        value={row.value}
                        onChange={(e) => handleSpecRowChange(row.id, { value: e.target.value })}
                        className="w-full px-2.5 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                        placeholder="e.g. W01-358 9781"
                      />
                    </div>
                    <div className="p-2 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeSpecRow(row.id)}
                        className="p-2 rounded-sm border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This table is converted to JSON automatically when you save.</p>
          </div>

          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Product Images</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {isNew &&
                pendingImages.map((img) => (
                  <div key={img.id} className="aspect-square bg-secondary rounded-sm overflow-hidden relative group">
                    <img src={img.previewUrl} alt={img.file.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePendingImage(img.id)}
                        disabled={busy}
                        className="opacity-0 group-hover:opacity-100 p-1 bg-background rounded-sm text-destructive disabled:opacity-50"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-muted text-foreground px-1.5 py-0.5 rounded-sm font-medium">
                      Pending
                    </span>
                  </div>
                ))}
              {images.map((img, idx) => {
                const isPrimary = img.is_primary === 1 || img.is_primary === true;
                return (
                  <div key={img.id} className={`bg-secondary rounded-sm overflow-hidden relative group border-2 ${isPrimary ? "border-accent" : "border-transparent"}`}>
                    <div className="aspect-square">
                      <img
                        src={resolveUploadImageUrl(img.image_url)}
                        alt={img.alt_text || form.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-1">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveImage(img.id, "left")}
                            disabled={busy}
                            className="p-1.5 bg-background rounded-sm hover:bg-secondary transition-colors disabled:opacity-50"
                            title="Move left"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(img.id)}
                            disabled={busy}
                            className="p-1.5 bg-background rounded-sm text-amber-500 hover:bg-secondary transition-colors disabled:opacity-50"
                            title="Set as primary"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img.id)}
                          disabled={busy}
                          className="p-1.5 bg-background rounded-sm text-destructive hover:bg-secondary transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {idx < images.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveImage(img.id, "right")}
                            disabled={busy}
                            className="p-1.5 bg-background rounded-sm hover:bg-secondary transition-colors disabled:opacity-50"
                            title="Move right"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {isPrimary && (
                      <span className="absolute top-1 left-1 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5" /> Primary
                      </span>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handlePickImage}
                disabled={busy}
                className="aspect-square border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs mt-1">Add</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Add images now. They will upload automatically when you save the new product."
                : "Hover over images to reorder (◀ ▶), set as primary (★), or delete. The primary image is shown first on the storefront."}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Status</h3>
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value as ProductStatus)}
              className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Category</h3>
            <select
              value={form.categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={categoriesLoading || categories.length === 0}
              className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none disabled:opacity-60"
            >
              {categoriesLoading && <option value="">Loading categories...</option>}
              {!categoriesLoading && categoriesError && <option value="">Could not load categories</option>}
              {!categoriesLoading && !categoriesError && categories.length === 0 && (
                <option value="">No categories found</option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {categoriesError && (
              <p className="text-xs text-destructive">Category list failed to load. Please refresh this page.</p>
            )}
          </div>

          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Pricing</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Retail Price (CAD)</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => updateField("price", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Wholesale Price (CAD)</label>
              <input
                type="number"
                step="0.01"
                value={form.wholesalePrice}
                onChange={(e) => updateField("wholesalePrice", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Discount (%)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={form.discountPercent}
                onChange={(e) => updateField("discountPercent", Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              />
              {form.discountPercent > 0 && form.price > 0 && (
                <p className="text-xs text-accent mt-1 font-medium">
                  Sale price: ${(form.price * (1 - form.discountPercent / 100)).toFixed(2)} CAD
                </p>
              )}
            </div>
            {form.price > 0 && form.wholesalePrice > 0 && (
              <p className="text-xs text-muted-foreground">
                Margin: {Math.round(((form.price - form.wholesalePrice) / form.price) * 100)}%
              </p>
            )}
          </div>

          {!isNew && <CustomerProductPrices productId={effectiveId} />}

          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Inventory</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Stock Quantity</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => updateField("stock", parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Minimum Stock Alert</label>
                <input
                  type="number"
                  value={form.minimumStock}
                  onChange={(e) => updateField("minimumStock", parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={form.weightLbs || 0}
                onChange={(e) => updateField("weightLbs", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="dashboard-card space-y-4">
            <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">SEO</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Meta Title</label>
              <input
                defaultValue={form.name}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                placeholder="Page title for search engines"
              />
              <p className="text-xs text-muted-foreground mt-1">{(form.name || "").length}/60 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meta Description</label>
              <textarea
                defaultValue={form.description?.slice(0, 160)}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent resize-none"
                placeholder="Description for search results"
              />
              <p className="text-xs text-muted-foreground mt-1">{(form.description || "").slice(0, 160).length}/160 characters</p>
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-40 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="flex-1 btn-accent py-3 rounded-sm text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Product
        </button>
      </div>
      <div className="sm:hidden h-16" />
    </div>
  );
}
