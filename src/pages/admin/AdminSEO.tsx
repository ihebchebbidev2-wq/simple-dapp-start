import React, { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Save, X, Globe, Eye, EyeOff, Code, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrapApiList } from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { useApiMutation } from "@/hooks/useApi";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SEOMetadata } from "@/components/SEOHead";

const COMMON_PAGES = [
  { path: "/", name: "Home" },
  { path: "/products", name: "Products" },
  { path: "/products/:categorySlug", name: "Product Category" },
  { path: "/product/:slug", name: "Product Detail" },
  { path: "/about", name: "About" },
  { path: "/contact", name: "Contact" },
  { path: "/faq", name: "FAQ" },
  { path: "/cart", name: "Cart" },
  { path: "/checkout", name: "Checkout" },
  { path: "/login", name: "Login" },
  { path: "/register", name: "Register" },
  { path: "/apply", name: "Apply" },
  { path: "/terms", name: "Terms" },
  { path: "/privacy", name: "Privacy" },
  { path: "/shipping", name: "Shipping" },
  { path: "/refund", name: "Refund" },
  { path: "/cookie", name: "Cookie Policy" },
];

const emptyForm: Omit<SEOMetadata, "id" | "is_active"> & { is_active: boolean } = {
  page_path: "",
  page_name: "",
  locale: "en",
  meta_title: "",
  meta_description: "",
  og_title: "",
  og_description: "",
  og_image: "",
  og_type: "website",
  twitter_title: "",
  twitter_description: "",
  twitter_image: "",
  twitter_card: "summary_large_image",
  canonical_url: "",
  json_ld: "",
  robots: "index, follow",
  keywords: "",
  is_active: true,
};

export default function AdminSEO() {
  const { t } = useLanguage();
  const confirmAction = useConfirm();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("basic");

  const { data: seoData, isLoading } = useQuery({
    queryKey: ["seo", "admin-list"],
    queryFn: () => api.request("GET", API_ENDPOINTS.SEO.ADMIN_LIST),
    staleTime: 1000 * 60 * 2,
  });

  const items: SEOMetadata[] = Array.isArray(seoData?.data) ? seoData.data : [];

  const filtered = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.page_path.toLowerCase().includes(q) ||
      item.page_name.toLowerCase().includes(q) ||
      (item.meta_title || "").toLowerCase().includes(q)
    );
  });

  const saveMutation = useApiMutation(
    (data: any) => {
      if (editingId) {
        return api.request("PUT", API_ENDPOINTS.SEO.UPDATE.replace(":id", editingId), data);
      }
      return api.request("POST", API_ENDPOINTS.SEO.CREATE, data);
    },
    {
      onSuccess: () => {
        showSuccessToast(editingId ? "SEO metadata updated" : "SEO metadata created");
        queryClient.invalidateQueries({ queryKey: ["seo"] });
        resetForm();
      },
      onError: (err: any) => {
        showErrorToast(err?.message || "Failed to save SEO metadata");
      },
    }
  );

  const deleteMutation = useApiMutation(
    (id: string) => api.request("DELETE", API_ENDPOINTS.SEO.DELETE.replace(":id", id)),
    {
      onSuccess: () => {
        showSuccessToast("SEO metadata deleted");
        queryClient.invalidateQueries({ queryKey: ["seo"] });
      },
    }
  );

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setActiveTab("basic");
  }

  function editItem(item: SEOMetadata) {
    setForm({
      page_path: item.page_path,
      page_name: item.page_name,
      locale: item.locale,
      meta_title: item.meta_title || "",
      meta_description: item.meta_description || "",
      og_title: item.og_title || "",
      og_description: item.og_description || "",
      og_image: item.og_image || "",
      og_type: item.og_type || "website",
      twitter_title: item.twitter_title || "",
      twitter_description: item.twitter_description || "",
      twitter_image: item.twitter_image || "",
      twitter_card: item.twitter_card || "summary_large_image",
      canonical_url: item.canonical_url || "",
      json_ld: item.json_ld || "",
      robots: item.robots || "index, follow",
      keywords: item.keywords || "",
      is_active: !!item.is_active,
    });
    setEditingId(item.id);
    setShowForm(true);
    setActiveTab("basic");
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({
      title: "Delete SEO Entry",
      message: "This will permanently remove this SEO metadata entry. Continue?",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) deleteMutation.mutate(id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.page_path.trim()) {
      showErrorToast("Page path is required");
      return;
    }
    saveMutation.mutate({
      ...form,
      is_active: form.is_active ? 1 : 0,
      og_title: form.og_title || null,
      og_description: form.og_description || null,
      og_image: form.og_image || null,
      twitter_title: form.twitter_title || null,
      twitter_description: form.twitter_description || null,
      twitter_image: form.twitter_image || null,
      canonical_url: form.canonical_url || null,
      json_ld: form.json_ld || null,
      keywords: form.keywords || null,
    });
  }

  const titleCharCount = (form.meta_title || "").length;
  const descCharCount = (form.meta_description || "").length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.nav.seo") || "SEO Manager"}
        subtitle="Manage meta titles, descriptions, Open Graph, Twitter Cards, JSON-LD, and robots for every page."
      />

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add SEO Entry
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {editingId ? "Edit SEO Metadata" : "New SEO Entry"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic SEO</TabsTrigger>
                  <TabsTrigger value="social">Social / OG</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Page Path *</Label>
                      <Select
                        value={COMMON_PAGES.find(p => p.path === form.page_path) ? form.page_path : "__custom__"}
                        onValueChange={(val) => {
                          if (val === "__custom__") return;
                          const pg = COMMON_PAGES.find(p => p.path === val);
                          setForm(f => ({ ...f, page_path: val, page_name: pg?.name || f.page_name }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a page" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_PAGES.map(p => (
                            <SelectItem key={p.path} value={p.path}>{p.name} ({p.path})</SelectItem>
                          ))}
                          <SelectItem value="__custom__">Custom path...</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="/custom-path"
                        value={form.page_path}
                        onChange={(e) => setForm(f => ({ ...f, page_path: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Page Name</Label>
                      <Input value={form.page_name} onChange={(e) => setForm(f => ({ ...f, page_name: e.target.value }))} placeholder="Home" />
                    </div>
                    <div className="space-y-2">
                      <Label>Locale</Label>
                      <Select value={form.locale} onValueChange={(v) => setForm(f => ({ ...f, locale: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Meta Title <span className={titleCharCount > 60 ? "text-destructive" : "text-muted-foreground"}>({titleCharCount}/60)</span></Label>
                    <Input
                      value={form.meta_title}
                      onChange={(e) => setForm(f => ({ ...f, meta_title: e.target.value }))}
                      placeholder="Page Title — REMQUIP"
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Meta Description <span className={descCharCount > 160 ? "text-destructive" : "text-muted-foreground"}>({descCharCount}/160)</span></Label>
                    <Textarea
                      value={form.meta_description}
                      onChange={(e) => setForm(f => ({ ...f, meta_description: e.target.value }))}
                      placeholder="Describe this page for search engines..."
                      rows={3}
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Keywords</Label>
                    <Input
                      value={form.keywords || ""}
                      onChange={(e) => setForm(f => ({ ...f, keywords: e.target.value }))}
                      placeholder="truck parts, heavy duty, brakes, wholesale"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
                    />
                    <Label>Active</Label>
                  </div>
                </TabsContent>

                <TabsContent value="social" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2"><Globe className="h-4 w-4" /> Open Graph</h3>
                      <div className="space-y-2">
                        <Label>OG Title</Label>
                        <Input value={form.og_title || ""} onChange={(e) => setForm(f => ({ ...f, og_title: e.target.value }))} placeholder="Defaults to meta title" />
                      </div>
                      <div className="space-y-2">
                        <Label>OG Description</Label>
                        <Textarea value={form.og_description || ""} onChange={(e) => setForm(f => ({ ...f, og_description: e.target.value }))} placeholder="Defaults to meta description" rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>OG Image URL</Label>
                        <Input value={form.og_image || ""} onChange={(e) => setForm(f => ({ ...f, og_image: e.target.value }))} placeholder="https://..." />
                      </div>
                      <div className="space-y-2">
                        <Label>OG Type</Label>
                        <Select value={form.og_type || "website"} onValueChange={(v) => setForm(f => ({ ...f, og_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="website">website</SelectItem>
                            <SelectItem value="article">article</SelectItem>
                            <SelectItem value="product">product</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">𝕏 Twitter Card</h3>
                      <div className="space-y-2">
                        <Label>Twitter Title</Label>
                        <Input value={form.twitter_title || ""} onChange={(e) => setForm(f => ({ ...f, twitter_title: e.target.value }))} placeholder="Defaults to OG title" />
                      </div>
                      <div className="space-y-2">
                        <Label>Twitter Description</Label>
                        <Textarea value={form.twitter_description || ""} onChange={(e) => setForm(f => ({ ...f, twitter_description: e.target.value }))} placeholder="Defaults to OG description" rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Twitter Image URL</Label>
                        <Input value={form.twitter_image || ""} onChange={(e) => setForm(f => ({ ...f, twitter_image: e.target.value }))} placeholder="https://..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Twitter Card Type</Label>
                        <Select value={form.twitter_card || "summary_large_image"} onValueChange={(v) => setForm(f => ({ ...f, twitter_card: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="summary">summary</SelectItem>
                            <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Canonical URL</Label>
                    <Input
                      value={form.canonical_url || ""}
                      onChange={(e) => setForm(f => ({ ...f, canonical_url: e.target.value }))}
                      placeholder="https://remquip.ca/products"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Robots</Label>
                    <Select value={form.robots || "index, follow"} onValueChange={(v) => setForm(f => ({ ...f, robots: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="index, follow">index, follow</SelectItem>
                        <SelectItem value="noindex, follow">noindex, follow</SelectItem>
                        <SelectItem value="index, nofollow">index, nofollow</SelectItem>
                        <SelectItem value="noindex, nofollow">noindex, nofollow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Code className="h-4 w-4" /> JSON-LD Structured Data</Label>
                    <Textarea
                      value={form.json_ld || ""}
                      onChange={(e) => setForm(f => ({ ...f, json_ld: e.target.value }))}
                      placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "...",\n  "description": "..."\n}'}
                      rows={8}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">Must be valid JSON. Will be injected as a &lt;script type=&quot;application/ld+json&quot;&gt; tag.</p>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-6">
                  {/* Google Preview */}
                  <div>
                    <h3 className="font-semibold mb-3">Google Search Preview</h3>
                    <div className="border rounded-lg p-4 bg-card max-w-xl">
                      <p className="text-primary text-lg leading-snug truncate">
                        {form.meta_title || "Page Title — REMQUIP"}
                      </p>
                      <p className="text-sm text-green-700 truncate mt-0.5">
                        {form.canonical_url || `https://remquip.ca${form.page_path || "/"}`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {form.meta_description || "No description set."}
                      </p>
                    </div>
                  </div>
                  {/* Social Preview */}
                  <div>
                    <h3 className="font-semibold mb-3">Social Share Preview</h3>
                    <div className="border rounded-lg overflow-hidden max-w-md bg-card">
                      {(form.og_image || form.twitter_image) && (
                        <div className="w-full h-40 bg-muted flex items-center justify-center overflow-hidden">
                          <img src={form.og_image || form.twitter_image || ""} alt="OG Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground uppercase">remquip.ca</p>
                        <p className="font-semibold text-sm mt-1 truncate">{form.og_title || form.meta_title || "Page Title"}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.og_description || form.meta_description || "No description."}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? "Update" : "Create"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "No matching SEO entries." : "No SEO metadata yet. Click \"Add SEO Entry\" to start."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Locale</TableHead>
                    <TableHead className="max-w-[300px]">Meta Title</TableHead>
                    <TableHead>Robots</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.page_path}</TableCell>
                      <TableCell>{item.page_name}</TableCell>
                      <TableCell><Badge variant="outline">{item.locale}</Badge></TableCell>
                      <TableCell className="max-w-[300px] truncate">{item.meta_title}</TableCell>
                      <TableCell className="text-xs">{item.robots}</TableCell>
                      <TableCell>
                        {item.is_active ? (
                          <Badge className="bg-primary/10 text-primary"><Eye className="h-3 w-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge variant="secondary"><EyeOff className="h-3 w-3 mr-1" />Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => editItem(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
