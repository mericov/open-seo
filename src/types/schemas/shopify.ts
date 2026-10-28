import { z } from "zod";
import { SHOPIFY_AUTH_MODES, SHOPIFY_SEO_RESOURCES } from "@/shared/shopify";

const projectIdShape = { projectId: z.string().min(1) };

export const shopifyProjectSchema = z.object(projectIdShape);

export const connectShopifySchema = z.object({
  ...projectIdShape,
  shopDomain: z.string().trim().min(1).max(255),
  authMode: z.enum(SHOPIFY_AUTH_MODES),
  clientId: z.string().trim().max(255).optional(),
  clientSecret: z.string().trim().max(500).optional(),
  accessToken: z.string().trim().max(500).optional(),
});

export const listShopifySeoSchema = z.object({
  ...projectIdShape,
  resource: z.enum(SHOPIFY_SEO_RESOURCES),
  search: z.string().trim().max(200).optional(),
  after: z.string().max(500).nullish(),
});

export const shopifySeoUpdateSchema = z.object({
  id: z.string().trim().min(1).max(200),
  seoTitle: z.string().max(255).nullish(),
  seoDescription: z.string().max(1000).nullish(),
});

export const updateShopifySeoSchema = z.object({
  ...projectIdShape,
  updates: z.array(shopifySeoUpdateSchema).min(1).max(100),
});

export const shopifyThemeSchema = z.object({
  ...projectIdShape,
  themeId: z.string().trim().min(1).max(200),
});

export const createShopifyThemeCopySchema = z.object({
  ...projectIdShape,
  summary: z.string().trim().min(1).max(120),
});

export const shopifyDraftSchema = z.object({
  ...projectIdShape,
  draftId: z.string().min(1),
});

export const publishShopifyDraftSchema = shopifyDraftSchema.extend({
  blogId: z.string().trim().min(1).max(200).optional(),
  publish: z.boolean().default(true),
});
