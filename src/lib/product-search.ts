import { api, type Product } from "@/lib/api";

const SEARCH_PAGE_SIZE = 100;

let searchableProductsCache: Product[] | null = null;
let searchableProductsPromise: Promise<Product[]> | null = null;

function stripDiacritics(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSearchValue(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactSearchValue(value: string): string {
  return normalizeSearchValue(value).replace(/\s+/g, "");
}

function getProductSearchFields(product: Product) {
  const categorySlug = (product as unknown as { categorySlug?: unknown }).categorySlug;
  const rawFields = [product.name, product.sku, product.category, product.description, categorySlug]
    .filter((value) => value != null && String(value).trim().length > 0)
    .map((value) => String(value));

  return rawFields.map((value) => ({
    normalized: normalizeSearchValue(value),
    compact: compactSearchValue(value),
  }));
}

export function getProductSearchScore(product: Product, query: string): number {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return 0;

  const compactQuery = compactSearchValue(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const fields = getProductSearchFields(product);

  const tokensMatch = queryTokens.every((token) =>
    fields.some((field) => field.normalized.includes(token) || field.compact.includes(token))
  );

  if (!tokensMatch) return 0;

  const name = fields[0]?.normalized ?? "";
  const sku = fields[1]?.normalized ?? "";
  const category = fields[2]?.normalized ?? "";
  const description = fields[3]?.normalized ?? "";
  const nameCompact = fields[0]?.compact ?? "";
  const skuCompact = fields[1]?.compact ?? "";

  let score = 0;

  if (skuCompact === compactQuery) score += 220;
  if (name === normalizedQuery) score += 180;
  if (skuCompact.startsWith(compactQuery)) score += 150;
  if (name.startsWith(normalizedQuery)) score += 130;
  if (nameCompact.includes(compactQuery)) score += 100;
  if (skuCompact.includes(compactQuery)) score += 95;
  if (category.includes(normalizedQuery)) score += 55;
  if (description.includes(normalizedQuery)) score += 25;

  score += Math.max(0, 12 - Math.abs(name.length - normalizedQuery.length));
  score += Math.max(0, 10 - queryTokens.length * 2);

  return score;
}

export function filterProductsByQuery(products: Product[], query: string): Product[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return products;

  return [...products]
    .map((product, index) => ({
      product,
      index,
      score: getProductSearchScore(product, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.product);
}

export async function loadAllSearchableProducts(forceRefresh = false): Promise<Product[]> {
  if (!forceRefresh && searchableProductsCache) return searchableProductsCache;
  if (!forceRefresh && searchableProductsPromise) return searchableProductsPromise;

  searchableProductsPromise = (async () => {
    const firstPage = await api.getProducts(1, SEARCH_PAGE_SIZE);
    const firstItems = Array.isArray(firstPage.data) ? firstPage.data : [];
    const totalPages = Math.max(1, Number((firstPage.pagination as { pages?: number } | undefined)?.pages ?? 1));

    if (totalPages === 1) {
      searchableProductsCache = firstItems;
      searchableProductsPromise = null;
      return firstItems;
    }

    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => api.getProducts(index + 2, SEARCH_PAGE_SIZE))
    );

    const allItems = [
      ...firstItems,
      ...remainingPages.flatMap((response) => (Array.isArray(response.data) ? response.data : [])),
    ];

    searchableProductsCache = allItems;
    searchableProductsPromise = null;
    return allItems;
  })().catch((error) => {
    searchableProductsPromise = null;
    throw error;
  });

  return searchableProductsPromise;
}
