import { z } from "zod";
import {
  BrandKitService,
  renderBrandKit,
} from "@/server/features/social/services/BrandKitService";
import { SocialContextService } from "@/server/features/social/services/SocialContextService";
import { SocialPostService } from "@/server/features/social/services/SocialPostService";
import { SocialMediaService } from "@/server/features/social/services/SocialMediaService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { brandKitInputSchema } from "@/types/schemas/social";

const socialPath = (projectId: string) => `/p/${projectId}/social`;

const contextInputSchema = {
  projectId: projectIdSchema,
  refresh: z
    .boolean()
    .default(false)
    .describe(
      "Rebuild the context now instead of using the daily cache. Use after the user changed the brand kit, published new posts or connected an integration.",
    ),
} as const;

export const getSocialContextTool = {
  name: "get_social_context",
  config: {
    title: "Get social & ads context",
    description:
      "Call this FIRST before writing any social post, post idea, ad copy or ad concept for a project. Returns the one shared context every social and ad generation must use: brand kit (tone, audience, colors, fonts, logo, banned phrases) merged with the project context, saved and rank-tracked keywords, Search Console top and rising queries and pages, GA4 top landing pages and best-selling items, the site's real collections, products (prices, images), pages, menu and blog articles, past blog drafts and social posts (never repeat their ideas, hooks or images), competitors, AI visibility prompts, and a list of missing data. Built from data MericSEO already has; cached daily. Uses no credits.",
    inputSchema: contextInputSchema,
    outputSchema: z
      .object({
        builtAt: z.string(),
        project: looseObjectOutputSchema,
        missing: z.array(z.string()),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof contextInputSchema>>, context) => {
      const socialContext = await SocialContextService.get(args.projectId, {
        refresh: args.refresh,
      });
      return mcpResponse({
        text: SocialContextService.render(socialContext),
        meta: buildProjectMeta(
          context,
          args.projectId,
          socialPath(args.projectId),
        ),
        structuredContent: socialContext,
      });
    },
  ),
};

const mediaInputSchema = {
  projectId: projectIdSchema,
  url: z
    .string()
    .trim()
    .url()
    .describe(
      "Public https URL of the image or video to store: a Higgsfield result URL, a Shopify CDN image from get_social_context, or another image the user approved. JPEG and PNG images (PNG is converted to JPEG) and MP4/MOV videos.",
    ),
  source: z
    .enum(["higgsfield", "shopify", "url"])
    .describe("Where the file came from."),
  label: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Short description, e.g. '4:5 product shot with headline'."),
  postId: z
    .string()
    .optional()
    .describe(
      "Attach the file to this social post draft (appended after existing media).",
    ),
} as const;

export const saveSocialMediaTool = {
  name: "save_social_media",
  config: {
    title: "Save social media file",
    description:
      "Copy an image or video into MericSEO's public media store (Cloudflare R2) so Instagram and Facebook can fetch it. Returns the asset id to attach to a post or ad, the public URL, and the pixel size. Use it for every Higgsfield output and every site image you plan to post. Uses no credits.",
    inputSchema: mediaInputSchema,
    outputSchema: z
      .object({
        id: z.string(),
        url: z.string(),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof mediaInputSchema>>, context) => {
      const asset = await SocialMediaService.importFromUrl({
        projectId: args.projectId,
        origin: context.baseUrl,
        url: args.url,
        source: args.source,
        label: args.label ?? null,
      });
      if (args.postId)
        await SocialPostService.attachMedia(args.projectId, args.postId, [
          asset.id,
        ]);
      return mcpResponse({
        text: `${args.postId ? `Attached to post ${args.postId}. ` : ""}Saved media ${asset.id}: ${asset.url} (${asset.contentType}${asset.width ? `, ${asset.width}×${asset.height}` : ""}).`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          socialPath(args.projectId),
        ),
        structuredContent: asset,
      });
    },
  ),
};

const saveBrandKitInputSchema = {
  projectId: projectIdSchema,
  brandKit: brandKitInputSchema.describe(
    "The full brand kit. Omitted fields are cleared, so send every field you want to keep (read it first with get_social_context). Colors are #RRGGBB hex; bannedPhrases is one phrase per line; logoUrl should be a save_social_media URL.",
  ),
} as const;

export const saveBrandKitTool = {
  name: "save_brand_kit",
  config: {
    title: "Save brand kit",
    description:
      "Save the project's brand kit (tone, target audience, colors, fonts, logo, banned phrases). It is part of the project context and every social post and ad uses it. Confirm the values with the user before saving. Uses no credits.",
    inputSchema: saveBrandKitInputSchema,
    outputSchema: z
      .object({ saved: z.boolean(), ...optionalMetaOutputSchema })
      .passthrough(),
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (
      args: z.infer<z.ZodObject<typeof saveBrandKitInputSchema>>,
      context,
    ) => {
      const kit = await BrandKitService.save(args.projectId, args.brandKit);
      await SocialContextService.invalidate(args.projectId);
      return mcpResponse({
        text: `Brand kit saved.\n\n${renderBrandKit(kit)}`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          `/p/${args.projectId}/context`,
        ),
        structuredContent: { saved: true },
      });
    },
  ),
};
