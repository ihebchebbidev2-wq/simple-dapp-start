import React, { useState, useMemo, useCallback } from "react";
import {
  Layers,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  ImageIcon,
  Languages,
  Upload,
  Package,
  X,
} from "lucide-react";
import { localeLabel } from "@/contexts/LanguageContext";
import { useAdminCategoriesList, useApiMutation, useStorefrontRates } from "@/hooks/useApi";
import { api, unwrapApiList, unwrapPagination, resolveBackendUploadUrl, type ProductCategory } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { categories as defaultCatalogCategories } from "@/config/products";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

type LocForm = { name: string; description: string };

const emptyLoc: LocForm = { name: "", description: "" };

export default function AdminCategories() {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [langTab, setLangTab] = useState<string>("en");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pickerImages, setPickerImages] = useState<{ id: string; url: string; productName: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const { data: storefront } = useStorefrontRates();
  const supportedLocales = (storefront as { data?: { supported_locales?: string[] } } | undefined)?.data?.supported_locales ?? ["en", "fr"];

  const [form, setForm] = useState<{
    slug: string;
    imageUrl: string;
    displayOrder: number;
    isActive: boolean;
    [key: string]: string | number | boolean | LocForm;
  }>({
    slug: "",
    imageUrl: "",
    displayOrder: 0,
    isActive: true,
    en: { ...emptyLoc },
    fr: { ...emptyLoc },
  });

  const queryClient = useQueryClient();
  const { data: catRes, isLoading, isError, error } = useAdminCategoriesList();

  const defaultImageBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    defaultCatalogCategories.forEach((c) => {
      map[c.slug] = c.image;
    });
    return map;
  }, []);

  const createMutation = useApiMutation((payload: Record<string, unknown>) => api.createCategory(payload as any), {
    onSuccess: () => {
      showSuccessToast("Categories", "Category created successfully");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      closeForm();
    },
    onError: (e: unknown) => {
      showErrorToast("Categories", e instanceof Error ? e.message : "Failed to create category");
    },
  });

  const updateMutation = useApiMutation(
    ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.updateCategory(id, payload as any),
    {
      onSuccess: () => {
        showSuccessToast("Categories", "Category updated successfully");
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        closeForm();
      },
      onError: (e: unknown) => {
        showErrorToast("Categories", e instanceof Error ? e.message : "Failed to update category");
      },
    }
  );

  const deleteMutation = useApiMutation((id: string) => api.deleteCategory(id), {
    onSuccess: () => {
      showSuccessToast("Categories", "Category deleted");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: unknown) => {
      showErrorToast("Categories", e instanceof Error ? e.message : "Delete failed");
    },
  });

  const rows = unwrapApiList<ProductCategory>(catRes, []);
  const pagination = unwrapPagination(catRes);
  const rowsWithDefaultImages = useMemo(() => {
    return rows.map((c) => {
      const img = String(c.image_url ?? "").trim();
      if (img) return c;
      const fallback = defaultImageBySlug[c.slug] ?? "";
      return { ...c, image_url: fallback };
    });
  }, [rows, defaultImageBySlug]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rowsWithDefaultImages;
    return rowsWithDefaultImages.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [rowsWithDefaultImages, search]);

  async function openProductImagePicker(categoryId: string | null) {
    if (!categoryId) {
      showErrorToast("Pick from products", "Save the category first, then edit it to pick product images.");
      return;
    }
    setPickerLoading(true);
    setShowImagePicker(true);
    setPickerImages([]);
    try {
      const res = await api.request('GET', `/products/category/${categoryId}?limit=100`);
      // Backend returns paginated: { data: { items: [...] } } or flat array
      const rawData = res?.data;
      const products: Record<string, unknown>[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray((rawData as any)?.items)
          ? (rawData as any).items
          : Array.isArray((rawData as any)?.data)
            ? (rawData as any).data
            : [];
      const imgs: { id: string; url: string; productName: string }[] = [];
      for (const p of products) {
        const pImages = Array.isArray(p.images) ? p.images as Record<string, unknown>[] : [];
        const pName = String(p.name ?? "Product");
        if (pImages.length > 0) {
          for (const img of pImages) {
            const url = String(img.image_url ?? img.url ?? "");
            if (url) imgs.push({ id: String(img.id ?? imgs.length), url, productName: pName });
          }
        } else {
          const fallbackImg = String(p.image ?? "");
          if (fallbackImg) imgs.push({ id: String(p.id ?? imgs.length), url: fallbackImg, productName: pName });
        }
      }
      setPickerImages(imgs);
    } catch {
      showErrorToast("Pick from products", "Could not load product images.");
    } finally {
      setPickerLoading(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setLangTab(supportedLocales[0] ?? "en");
    const base: Record<string, unknown> = { slug: "", imageUrl: "", displayOrder: 0, isActive: true };
    supportedLocales.forEach((loc) => {
      base[loc] = { ...emptyLoc };
    });
    setForm(base as typeof form);
  }

  async function openEdit(c: ProductCategory) {
    setEditingId(c.id);
    setShowForm(true);
    setLangTab(supportedLocales[0] ?? "en");
    const locData: Record<string, LocForm> = {};
    supportedLocales.forEach((loc) => {
      locData[loc] = { name: loc === (supportedLocales[0] ?? "en") ? c.name : "", description: loc === (supportedLocales[0] ?? "en") ? (c.description || "") : "" };
    });
    try {
      const tr = await api.getCategoryTranslations(c.id);
      const pack = (tr as { data?: { translations?: Record<string, { name: string; description?: string } | null> } })
        .data?.translations;
      if (pack) {
        supportedLocales.forEach((loc) => {
          const p = pack[loc];
          if (p?.name) {
            locData[loc] = { name: p.name, description: p.description || "" };
          }
        });
      }
    } catch {
      /* use base */
    }
    setForm({
      slug: c.slug,
      imageUrl: String(c.image_url ?? "").trim() ? (c.image_url as string) : defaultImageBySlug[c.slug] ?? "",
      displayOrder: c.display_order ?? 0,
      isActive: c.is_active !== false && (c as any).is_active !== 0,
      ...locData,
    });
  }

  async function handleSubmit() {
    const defaultLoc = supportedLocales[0] ?? "en";
    const defaultForm = form[defaultLoc] as LocForm | undefined;
    const defaultName = defaultForm?.name?.trim();
    if (!defaultName) return;
    const slug =
      String(form.slug || "").trim() ||
      defaultName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const translations: Record<string, { name: string; description: string }> = {};
    supportedLocales.forEach((loc) => {
      const f = form[loc] as LocForm | undefined;
      if (f?.name?.trim()) {
        translations[loc] = { name: f.name.trim(), description: f.description || "" };
      }
    });
    if (!translations[defaultLoc]) {
      translations[defaultLoc] = { name: defaultName, description: (defaultForm?.description || "") as string };
    }

    if (!editingId) {
      await createMutation.mutateAsync({
        name: defaultName,
        slug,
        description: (defaultForm?.description || "") as string,
        imageUrl: form.imageUrl,
        displayOrder: form.displayOrder,
        translations,
      });
      return;
    }

    await updateMutation.mutateAsync({
      id: editingId,
      payload: {
        name: defaultName,
        slug,
        description: (defaultForm?.description || "") as string,
        imageUrl: form.imageUrl,
        displayOrder: form.displayOrder,
        is_active: form.isActive,
        translations,
      },
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'categories');
      
      const res = await api.request('POST', '/uploads/image', formData);
      if (res.success && res.data?.url) {
        setForm(prev => ({ ...prev, imageUrl: res.data.url }));
        showSuccessToast("Upload", "Image uploaded successfully");
      }
    } catch (err) {
      showErrorToast("Upload", err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading) {
    return <AdminPageLoading message="Loading categories" />;
  }

  if (isError) {
    return (
      <AdminPageError
        message={error instanceof Error ? error.message : "Failed to load"}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["categories"] })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          title="Product categories"
          subtitle="English is the default catalog language; add French for the storefront language switcher."
          icon={Layers}
          actions={
            <button
              type="button"
              onClick={() => {
                closeForm();
                setShowForm(true);
                setEditingId(null);
              }}
              className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 self-start"
            >
              <Plus className="h-4 w-4" />
              New category
            </button>
          }
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or slug…"
            className="w-full pl-10 pr-3 py-2 border border-border rounded-sm text-sm bg-background"
          />
        </div>
      </div>

      {showForm && (
        <div className="dashboard-card space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Languages className="h-4 w-4 text-accent" />
            {editingId ? "Edit category" : "Create category"}
          </div>

          <div className="flex gap-2 border-b border-border pb-2">
            {supportedLocales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLangTab(loc)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wide ${
                  langTab === loc ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"
                }`}
              >
                {localeLabel(loc)}
              </button>
            ))}
          </div>

          {langTab === (supportedLocales[0] ?? "en") && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Name ({localeLabel(supportedLocales[0] ?? "en")}) *</label>
                <input
                  value={((form[supportedLocales[0] ?? "en"]) as LocForm)?.name ?? ""}
                  onChange={(e) => {
                    const loc = supportedLocales[0] ?? "en";
                    setForm({ ...form, [loc]: { ...((form[loc] as LocForm) ?? emptyLoc), name: e.target.value } });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">URL slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="auto from name if empty"
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1">Description ({localeLabel(supportedLocales[0] ?? "en")})</label>
                <textarea
                  value={((form[supportedLocales[0] ?? "en"]) as LocForm)?.description ?? ""}
                  onChange={(e) => {
                    const loc = supportedLocales[0] ?? "en";
                    setForm({ ...form, [loc]: { ...((form[loc] as LocForm) ?? emptyLoc), description: e.target.value } });
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm"
                />
              </div>
            </div>
          )}

          {langTab !== (supportedLocales[0] ?? "en") && supportedLocales.includes(langTab) && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Name ({localeLabel(langTab)})</label>
                <input
                  value={((form[langTab]) as LocForm)?.name ?? ""}
                  onChange={(e) => setForm({ ...form, [langTab]: { ...((form[langTab] as LocForm) ?? emptyLoc), name: e.target.value } })}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description ({localeLabel(langTab)})</label>
                <textarea
                  value={((form[langTab]) as LocForm)?.description ?? ""}
                  onChange={(e) => setForm({ ...form, [langTab]: { ...((form[langTab] as LocForm) ?? emptyLoc), description: e.target.value } })}
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" /> Image URL
              </label>
              <input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://… or /Backend/uploads/…"
                className="w-full px-3 py-2 border border-border rounded-sm text-sm font-mono text-xs"
              />
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-muted border border-border rounded-sm text-xs font-medium transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {isUploading ? "Uploading..." : "Upload Image"}
                </button>
                <button
                  type="button"
                  onClick={() => openProductImagePicker(editingId)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-muted border border-border rounded-sm text-xs font-medium transition-colors"
                >
                  <Package className="h-3.5 w-3.5" />
                  Pick from products
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: "" })}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Product Image Picker Modal */}
              {showImagePicker && (
                <div className="mt-3 border border-border rounded-sm bg-background p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Select a product image
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowImagePicker(false)}
                      className="p-1 hover:bg-secondary rounded-sm transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  {pickerLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs">Loading product images…</span>
                    </div>
                  ) : pickerImages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No product images found in this category.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                      {pickerImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, imageUrl: img.url }));
                            setShowImagePicker(false);
                            showSuccessToast("Image selected", `Using image from "${img.productName}"`);
                          }}
                          className="group relative aspect-square rounded-sm overflow-hidden border-2 border-border hover:border-accent transition-colors"
                          title={img.productName}
                        >
                          <img
                            src={resolveBackendUploadUrl(img.url)}
                            alt={img.productName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute bottom-0 left-0 right-0 bg-foreground/70 text-background text-[9px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {img.productName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {form.imageUrl.trim() ? (
                <img
                  src={resolveBackendUploadUrl(form.imageUrl.trim())}
                  alt="Category preview"
                  className="mt-2 h-20 w-full object-cover rounded-sm border border-border bg-muted/20"
                  loading="lazy"
                />
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Display order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-sm text-sm"
              />
            </div>
            {editingId && (
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat-active"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <label htmlFor="cat-active" className="text-sm">
                  Active (visible on storefront)
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-accent px-6 py-2 rounded-sm text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editingId ? "Save" : "Create"}
            </button>
            <button type="button" onClick={closeForm} className="px-6 py-2 border border-border rounded-sm text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Slug</th>
              <th className="text-left p-3 hidden md:table-cell">Image</th>
              <th className="text-left p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-secondary/40">
                <td className="p-3 text-muted-foreground">{c.display_order ?? 0}</td>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 font-mono text-xs">{c.slug}</td>
                <td className="p-3 hidden md:table-cell max-w-[200px] truncate text-xs text-muted-foreground">
                  {c.image_url ? (
                    <img
                      src={resolveBackendUploadUrl(String(c.image_url))}
                      alt={c.name}
                      className="h-10 w-16 object-cover rounded-sm border border-border bg-muted/20"
                      loading="lazy"
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3">{c.is_active === false || (c as any).is_active === 0 ? "No" : "Yes"}</td>
                <td className="p-3 text-right space-x-1">
                  <button
                    type="button"
                    onClick={() => void openEdit(c)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs bg-secondary hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_category"), variant: "danger" });
                      if (ok) deleteMutation.mutate(c.id);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
