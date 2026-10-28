import { z } from "zod";
import { ShopifyBlogService } from "@/server/features/shopify/services/ShopifyBlogService";
import { ShopifyContentService } from "@/server/features/shopify/services/ShopifyContentService";
import { ShopifyService } from "@/server/features/shopify/services/ShopifyService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import {
  projectInput,
  readOnly,
  respond,
  resultOutputSchema,
  shopifyPath,
  writes,
} from "@/server/mcp/tools/shopify-tool-support";
import { SHOPIFY_SEO_RESOURCES } from "@/shared/shopify";
import { shopifySeoUpdateSchema } from "@/types/schemas/shopify";

export const getShopifyOverviewTool = {
  name: "get_shopify_overview",
  config: {
    title: "Get Shopify store overview",
    description:
      "Start here for any Shopify task. Returns the project's connected Shopify store (name, domains, granted scopes, missing scopes) and the last 30 days of sessions, orders and sales with the previous 30 days for comparison. Uses no credits.",
    inputSchema: projectInput,
    outputSchema: z
      .object({
        connection: looseObjectOutputSchema,
        overview: looseObjectOutputSchema,
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: readOnly,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof projectInput>>, context) => {
      const connection = await ShopifyService.getConnection(args.projectId);
      const overview = connection.connected
        ? await ShopifyService.getOverview(args.projectId)
        : { connected: false };
      return mcpResponse({
        text: connection.connected
          ? JSON.stringify({ connection, overview }, null, 2)
          : "Shopify is not connected for this project. Ask the user to connect it in MericSEO under Settings → Integrations → Shopify.",
        meta: buildProjectMeta(
          context,
          args.projectId,
          shopifyPath(args.projectId),
        ),
        structuredContent: { connection, overview },
      });
    },
  ),
};

const graphqlInput = {
  projectId: projectIdSchema,
  query: z
    .string()
    .min(1)
    .max(50_000)
    .describe(
      "A Shopify Admin GraphQL query or mutation (API version 2026-04).",
    ),
  variables: z.record(z.string(), z.unknown()).optional(),
} as const;

export const shopifyAdminGraphqlTool = {
  name: "shopify_admin_graphql",
  config: {
    title: "Run Shopify Admin GraphQL",
    description:
      "Run any Shopify Admin GraphQL query or mutation against the project's connected store: products, collections, pages, articles, metafields, redirects, menus, files, orders, ShopifyQL analytics (shopifyqlQuery) and more. Use it for anything the dedicated Shopify tools don't cover. Theme file writes and theme publishing are blocked here; use the theme tools. Confirm with the user before mutations that delete or bulk-change store data. Returns the raw response, including errors and userErrors. Uses no credits.",
    inputSchema: graphqlInput,
    outputSchema: resultOutputSchema,
    annotations: { ...writes, destructiveHint: true },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof graphqlInput>>, context) => {
      const result = await ShopifyService.adminGraphql(
        args.projectId,
        args.query,
        args.variables,
      );
      return respond(context, args.projectId, "Shopify response:", result);
    },
  ),
};

const seoListInput = {
  projectId: projectIdSchema,
  resource: z.enum(SHOPIFY_SEO_RESOURCES),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Shopify search syntax, e.g. title:*kolye*"),
  after: z
    .string()
    .max(500)
    .optional()
    .describe("nextCursor from a previous call"),
} as const;

export const getShopifySeoTool = {
  name: "get_shopify_seo",
  config: {
    title: "List Shopify SEO titles and descriptions",
    description:
      "List products, collections, pages or blog articles with their SEO title and meta description (50 per page, most recently updated first). Uses no credits.",
    inputSchema: seoListInput,
    outputSchema: resultOutputSchema,
    annotations: readOnly,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof seoListInput>>, context) => {
      const result = await ShopifyContentService.listSeo(
        args.projectId,
        args.resource,
        { search: args.search, after: args.after },
      );
      return respond(
        context,
        args.projectId,
        `${result.items.length} ${args.resource}(s).`,
        result,
      );
    },
  ),
};

const seoUpdateInput = {
  projectId: projectIdSchema,
  updates: z
    .array(shopifySeoUpdateSchema)
    .min(1)
    .max(100)
    .describe(
      "Shopify GIDs from get_shopify_seo. Omit a field to keep it; pass an empty string to clear it.",
    ),
} as const;

export const updateShopifySeoTool = {
  name: "update_shopify_seo",
  config: {
    title: "Update Shopify SEO titles and descriptions",
    description:
      "Set the SEO title and meta description of products, collections, pages or articles in the connected Shopify store. Uses no credits.",
    inputSchema: seoUpdateInput,
    outputSchema: resultOutputSchema,
    annotations: writes,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof seoUpdateInput>>, context) => {
      const result = await ShopifyContentService.updateSeo(
        args.projectId,
        args.updates,
      );
      return respond(
        context,
        args.projectId,
        `Updated ${result.updated} item(s).`,
        result,
      );
    },
  ),
};

const uploadInput = {
  projectId: projectIdSchema,
  images: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string().max(512).optional(),
        filename: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(25),
} as const;

export const uploadImagesToShopifyTool = {
  name: "upload_images_to_shopify",
  config: {
    title: "Upload images to Shopify Files",
    description:
      "Upload images by public URL to the store's Files (Content → Files) and return their Shopify CDN URLs. Use it for images found with find_blog_images or any other public image. Uses no credits.",
    inputSchema: uploadInput,
    outputSchema: resultOutputSchema,
    annotations: writes,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof uploadInput>>, context) => {
      const result = await ShopifyContentService.uploadImages(
        args.projectId,
        args.images,
      );
      return respond(context, args.projectId, "Uploaded images:", result);
    },
  ),
};

const publishInput = {
  projectId: projectIdSchema,
  draftId: z.string().min(1).describe("Blog Writer draft id"),
  blogId: z
    .string()
    .optional()
    .describe("Shopify blog GID. Defaults to the store's first blog."),
  publish: z.boolean().default(true).describe("false creates a hidden article"),
} as const;

export const publishBlogToShopifyTool = {
  name: "publish_blog_to_shopify",
  config: {
    title: "Publish blog draft to Shopify",
    description:
      "Publish a Blog Writer draft as a Shopify blog article: uploads its images to Shopify Files and swaps them to CDN URLs, sets the featured image, SEO title, meta description, handle and excerpt, and adds the post to Blog Tracking. Publishing the same draft again updates the existing article. Uses no credits.",
    inputSchema: publishInput,
    outputSchema: resultOutputSchema,
    annotations: writes,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof publishInput>>, context) => {
      const result = await ShopifyBlogService.publishDraft(
        args.projectId,
        args.draftId,
        { blogId: args.blogId, publish: args.publish },
      );
      return respond(
        context,
        args.projectId,
        `${result.updatedExisting ? "Updated" : "Created"} article: ${result.url}`,
        result,
      );
    },
  ),
};
