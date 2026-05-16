import { resolveUploadImageUrl } from "@/lib/api";

/**
 * Normalized product shape for cart, product detail, and listing cards.
 * Matches what legacy `@/config/products` Product provided to the UI.
 */
export type StorefrontProduct = {
  id: string;
  name: string;
  sku: string;
  /** URL segment for /product/:slugOrId — prefers details.slug, else product id */
  slug: string;
  category: string;
  categorySlug: string;
  category_id: string;
  description: string;
  specifications: Record<string, string | string[]>;
  images: { id: string; url: string; alt: string; position: number }[];
  image: string;
  /** Original base price (never modified by discount) */
  price: number;
  /** Computed sale price after discount (equals price when no discount) */
  salePrice: number;
  /** Discount percentage 0-100 */
  discountPercent: number;
  wholesalePrice: number;
  stock: number;
  compatibility?: string[];
};

export function productDetailHref(id: string, slug?: string): string {
  const s = slug?.trim();
  return `/product/${encodeURIComponent(s || id)}`;
}

/** Map a product list row or GET /products/:id payload to storefront fields.
 *  @param augmentationPercent — per-customer price markup (0-100). Applied on top of salePrice.
 *  @param productAugmentations — optional map of product_id → augmentation_percent overrides. */
export function apiProductToStorefront(
  p: Record<string, unknown>,
  augmentationPercent = 0,
  productAugmentations: Record<string, number> = {},
): StorefrontProduct {
  const details =
    p.details && typeof p.details === "object" && !Array.isArray(p.details)
      ? (p.details as Record<string, unknown>)
      : {};

  const specs = details.specifications;
  const specifications: Record<string, string | string[]> = {};
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    for (const [k, v] of Object.entries(specs as Record<string, unknown>)) {
      if (Array.isArray(v)) specifications[k] = v.map(String);
      else specifications[k] = String(v ?? "");
    }
  }

  const slugFromDetails = details.slug != null ? String(details.slug).trim() : "";
  const slug = slugFromDetails || String(p.id ?? "");

  const rawImages = Array.isArray(p.images) ? (p.images as Record<string, unknown>[]) : [];
  const images = rawImages.map((img, i) => ({
    id: String(img.id ?? `img-${i}`),
    url: resolveUploadImageUrl(String(img.image_url ?? img.url ?? "")),
    alt: String(img.alt_text ?? img.alt ?? p.name ?? "Product"),
    position: i,
  }));

  const listThumb = p.image != null ? resolveUploadImageUrl(String(p.image)) : "";

  if (images.length === 0 && listThumb) {
    images.push({
      id: "primary",
      url: listThumb,
      alt: String(p.name ?? "Product"),
      position: 0,
    });
  }

  const primaryRaw = rawImages.find((img) => img.is_primary === 1 || img.is_primary === true);
  const primaryUrl = primaryRaw
    ? resolveUploadImageUrl(String(primaryRaw.image_url ?? ""))
    : rawImages[0]
      ? resolveUploadImageUrl(String(rawImages[0].image_url ?? ""))
      : listThumb;

  const image = primaryUrl || images[0]?.url || listThumb || "";

  const basePrice = Number(p.base_price ?? p.price ?? 0);
  const discountPercent = Number(p.discount_percent ?? 0);
  let salePrice = discountPercent > 0
    ? Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100
    : basePrice;

  // Apply per-product augmentation (if set) or general customer augmentation
  // Positive = markup, negative = discount
  const productId = String(p.id ?? "");
  const effectiveAugmentation = productAugmentations[productId] ?? augmentationPercent;
  if (effectiveAugmentation !== 0) {
    salePrice = Math.round(salePrice * (1 + effectiveAugmentation / 100) * 100) / 100;
    salePrice = Math.max(0, salePrice); // never go below 0
  }

  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    sku: String(p.sku ?? ""),
    slug,
    category: String(p.category ?? ""),
    categorySlug: String(p.categorySlug ?? ""),
    category_id: String(p.category_id ?? ""),
    description: String(p.description ?? ""),
    specifications,
    images,
    image,
    price: basePrice,
    salePrice,
    discountPercent,
    wholesalePrice: Number(p.cost_price ?? p.wholesale_price ?? 0),
    stock: Math.max(0, Number(p.stock ?? p.stock_quantity ?? 0)),
    compatibility: Array.isArray(details.compatibility) ? details.compatibility.map(String) : undefined,
  };
}
