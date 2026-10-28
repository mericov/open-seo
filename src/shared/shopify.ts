export const SHOPIFY_AUTH_MODES = [
  "client_credentials",
  "access_token",
] as const;

export type ShopifyAuthMode = (typeof SHOPIFY_AUTH_MODES)[number];

export const SHOPIFY_SEO_RESOURCES = [
  "product",
  "collection",
  "page",
  "article",
] as const;

export type ShopifySeoResource = (typeof SHOPIFY_SEO_RESOURCES)[number];

export const SHOPIFY_RECOMMENDED_SCOPES = [
  "read_products",
  "write_products",
  "read_content",
  "write_content",
  "read_online_store_pages",
  "write_online_store_pages",
  "read_themes",
  "write_themes",
  "read_files",
  "write_files",
  "read_reports",
  "read_orders",
  "read_analytics",
];

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShopDomain(input: string): string | null {
  const trimmed = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^admin\.shopify\.com\/store\//, "")
    .split(/[/?#]/)[0];
  if (!trimmed) return null;
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return SHOP_DOMAIN.test(domain) ? domain : null;
}

export function shopHandle(shopDomain: string) {
  return shopDomain.replace(/\.myshopify\.com$/, "");
}

export function numericShopifyId(gid: string) {
  return gid.split("/").pop() ?? gid;
}

const MERICSEO_THEME_PREFIX = "MericSEO v";

export function themeCopyName(version: number, summary: string) {
  const base = `${MERICSEO_THEME_PREFIX}${version} · `;
  const room = 50 - base.length;
  const clean = summary.trim().replace(/\s+/g, " ");
  return base + (clean.length > room ? `${clean.slice(0, room - 1)}…` : clean);
}

export function themeCopyVersion(name: string): number | null {
  const match = /^MericSEO v(\d+)/.exec(name);
  return match ? Number(match[1]) : null;
}
