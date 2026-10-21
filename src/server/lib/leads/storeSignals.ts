import { z } from "zod";
import { asNodes, firstOfType, jsonLdNodes } from "@/server/lib/leads/jsonLd";
import type { SitePlatform } from "@/server/lib/leads/marketingSignals";
import type { ParsedPage } from "@/server/lib/leads/pageParser";
import { SHOPIFY_PRODUCTS_PATH } from "@/server/lib/leads/shopifyStore";
import type { LeadFinding } from "@/shared/leadFindings";

const WOO_PRODUCTS_PATH = "/wp-json/wc/store/v1/products?per_page=25";
const STALE_PRODUCTS_DAYS = 365;
const PRODUCT_PATH_PATTERN = /\/(products?|urun|urunler|shop)\/[^/?#]+\/?$/i;

const shopifyProducts = z.object({
  products: z.array(
    z.object({
      handle: z.string(),
      body_html: z.string().nullish(),
      published_at: z.string().nullish(),
      created_at: z.string().nullish(),
      images: z.array(z.unknown()).nullish(),
      variants: z.array(z.object({ available: z.boolean().nullish() })),
    }),
  ),
});

const wooProducts = z.array(
  z.object({
    permalink: z.string(),
    description: z.string().nullish(),
    short_description: z.string().nullish(),
    images: z.array(z.unknown()).nullish(),
    is_in_stock: z.boolean().nullish(),
  }),
);

type CatalogItem = {
  url: string;
  soldOut: boolean;
  hasDescription: boolean;
  imageCount: number;
  publishedAt: number | null;
};

function hasText(html: string | null | undefined): boolean {
  return (html ?? "").replace(/<[^>]*>/g, " ").trim().length >= 20;
}

export async function readCatalog(
  platform: SitePlatform,
  origin: string,
  fetchJson: (path: string) => Promise<unknown>,
): Promise<CatalogItem[]> {
  if (platform === "shopify") {
    const parsed = shopifyProducts.safeParse(
      await fetchJson(SHOPIFY_PRODUCTS_PATH),
    );
    if (!parsed.success) return [];
    return parsed.data.products.map((product) => {
      const published = Date.parse(
        product.published_at ?? product.created_at ?? "",
      );
      return {
        url: new URL(`/products/${product.handle}`, origin).toString(),
        soldOut:
          product.variants.length > 0 &&
          product.variants.every((variant) => variant.available === false),
        hasDescription: hasText(product.body_html),
        imageCount: product.images?.length ?? 0,
        publishedAt: Number.isFinite(published) ? published : null,
      };
    });
  }
  if (platform === "woocommerce") {
    const parsed = wooProducts.safeParse(await fetchJson(WOO_PRODUCTS_PATH));
    if (!parsed.success) return [];
    return parsed.data.map((product) => ({
      url: product.permalink,
      soldOut: product.is_in_stock === false,
      hasDescription:
        hasText(product.description) || hasText(product.short_description),
      imageCount: product.images?.length ?? 0,
      publishedAt: null,
    }));
  }
  return [];
}

export function productUrlFrom(
  catalog: CatalogItem[],
  page: ParsedPage,
  baseUrl: string,
): string | null {
  const base = new URL(baseUrl);
  const fromCatalog = catalog.find(
    (item) => URL.parse(item.url)?.origin === base.origin,
  );
  if (fromCatalog) return fromCatalog.url;
  for (const anchor of page.anchors) {
    const url = URL.parse(anchor.href, base);
    if (
      url &&
      url.origin === base.origin &&
      PRODUCT_PATH_PATTERN.test(url.pathname)
    ) {
      url.hash = "";
      return url.toString();
    }
  }
  return null;
}

function share(count: number, total: number) {
  return `${Math.round((count / total) * 100)}%`;
}

export function detectCatalogFindings(catalog: CatalogItem[]): LeadFinding[] {
  const findings: LeadFinding[] = [];
  const total = catalog.length;
  if (total < 5) return findings;
  const soldOut = catalog.filter((item) => item.soldOut).length;
  if (soldOut / total >= 0.25) {
    findings.push({ code: "out_of_stock", detail: share(soldOut, total) });
  }
  const noDescription = catalog.filter((item) => !item.hasDescription).length;
  if (noDescription >= 3) {
    findings.push({
      code: "empty_descriptions",
      detail: `${noDescription}/${total}`,
    });
  }
  const singleImage = catalog.filter((item) => item.imageCount <= 1).length;
  if (singleImage / total >= 0.4) {
    findings.push({
      code: "single_image_products",
      detail: `${singleImage}/${total}`,
    });
  }
  const dates = catalog
    .map((item) => item.publishedAt)
    .filter((value): value is number => value !== null);
  const latest = dates.length ? Math.max(...dates) : null;
  if (latest && Date.now() - latest > STALE_PRODUCTS_DAYS * 86_400_000) {
    findings.push({
      code: "stale_products",
      detail: new Date(latest).toISOString().slice(0, 7),
    });
  }
  return findings;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function detectProductPageFindings(html: string): LeadFinding[] {
  const nodes = jsonLdNodes(html);
  const product = firstOfType(nodes, ["Product", "ProductGroup"]);
  if (!product) return [{ code: "no_product_schema", detail: null }];
  const offers = asNodes(product.offers).flatMap((offer) => [
    offer,
    ...asNodes(offer.offers),
  ]);
  const variants = asNodes(product.hasVariant);
  const offerNodes = [
    ...offers,
    ...variants.flatMap((variant) => asNodes(variant.offers)),
  ];
  const candidates = [product, ...variants, ...offerNodes];
  const missing: string[] = [];
  if (
    !offerNodes.some(
      (offer) => hasValue(offer.price) || hasValue(offer.lowPrice),
    )
  ) {
    missing.push("price");
  }
  if (!offerNodes.some((offer) => hasValue(offer.availability))) {
    missing.push("availability");
  }
  if (!hasValue(product.brand)) missing.push("brand");
  if (
    !candidates.some((node) =>
      ["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "mpn"].some((key) =>
        hasValue(node[key]),
      ),
    )
  ) {
    missing.push("GTIN");
  }
  if (!hasValue(product.image)) missing.push("image");
  return missing.length
    ? [{ code: "product_schema_gaps", detail: missing.join(", ") }]
    : [];
}
