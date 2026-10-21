import { z } from "zod";

const metaSchema = z.object({
  name: z.string().nullish(),
  country: z.string().nullish(),
  currency: z.string().nullish(),
  myshopify_domain: z.string().min(1),
  published_products_count: z.number().nullish(),
});

const productsSchema = z.object({
  products: z.array(
    z.object({
      published_at: z.string().nullish(),
      created_at: z.string().nullish(),
    }),
  ),
});

export type ShopifyStats = {
  name: string | null;
  countryCode: string | null;
  currency: string | null;
  productCount: number | null;
  lastProductAt: string | null;
};

export async function readShopifyStats(
  fetchJson: (path: string) => Promise<unknown>,
): Promise<ShopifyStats | null> {
  const meta = metaSchema.safeParse(await fetchJson("/meta.json"));
  if (!meta.success) return null;

  const products = productsSchema.safeParse(
    await fetchJson("/products.json?limit=5"),
  );
  const timestamps = products.success
    ? products.data.products
        .map((product) =>
          Date.parse(product.published_at ?? product.created_at ?? ""),
        )
        .filter(Number.isFinite)
    : [];

  return {
    name: meta.data.name?.trim() || null,
    countryCode: meta.data.country?.toUpperCase() ?? null,
    currency: meta.data.currency ?? null,
    productCount: meta.data.published_products_count ?? null,
    lastProductAt:
      timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : null,
  };
}
