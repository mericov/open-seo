import { z } from "zod";
import { BlogDraftService } from "@/server/features/blog-writer/services/BlogDraftService";
import { ShopifyService } from "@/server/features/shopify/services/ShopifyService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { blogDraftContentSchema } from "@/types/schemas/blog-writer";

const writerPath = (projectId: string) => `/p/${projectId}/blog-writer`;

const formatNumber = (value: number | null | undefined) =>
  value == null ? "?" : value.toLocaleString("en-US");

function linkSection(
  heading: string,
  rows: { url: string; label: string }[],
  limit: number,
) {
  return (
    `## ${heading} (${rows.length})\n` +
    (rows.length > 0
      ? rows
          .slice(0, limit)
          .map((row) => `- ${row.label}: ${row.url}`)
          .join("\n")
      : "None found.")
  );
}

const startInputSchema = { projectId: projectIdSchema } as const;

export const startBlogPostTool = {
  name: "start_blog_post",
  config: {
    title: "Start a blog post",
    description:
      "Start here whenever the user wants to write, plan or brainstorm a blog post or article for a project. Returns the step-by-step writing workflow to follow, the project's brand context and writing preferences, Search Console striking-distance queries (positions 5–20), saved keywords with volume and difficulty, and the keywords existing posts and drafts already target (to avoid cannibalization). Uses no credits.",
    inputSchema: startInputSchema,
    outputSchema: z
      .object({
        workflow: z.string(),
        project: looseObjectOutputSchema,
        searchConsole: looseObjectOutputSchema,
        savedKeywords: z.array(looseObjectOutputSchema),
        alreadyTargeted: z.array(looseObjectOutputSchema),
        recentFormats: z.array(looseObjectOutputSchema),
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
    async (args: z.infer<z.ZodObject<typeof startInputSchema>>, context) => {
      const [brief, shopify] = await Promise.all([
        BlogDraftService.getStartBrief(args.projectId),
        ShopifyService.getConnection(args.projectId),
      ]);
      const publishing = shopify.connected
        ? `Shopify is connected (${shopify.shopName ?? shopify.shopDomain}). Follow Step 8: publish the post live with publish_blog_to_shopify right after Step 7, without asking.`
        : "Shopify is not connected for this project. Skip Step 8 and give the user the draft link to copy the HTML.";
      const striking = brief.searchConsole.connected
        ? brief.searchConsole.rows.length > 0
          ? brief.searchConsole.rows
              .map(
                (row) =>
                  `- ${row.query} — avg position ${row.position.toFixed(1)}, ${formatNumber(row.impressions)} impressions, ${formatNumber(row.clicks)} clicks (page: ${row.page})`,
              )
              .join("\n")
          : "No queries in positions 5–20 over the last 3 months."
        : "Search Console is not connected for this project, so there are no ranking queries. Rely on saved keywords and research_keywords.";
      const saved =
        brief.savedKeywords.length > 0
          ? brief.savedKeywords
              .map(
                (row) =>
                  `- ${row.keyword} — volume ${formatNumber(row.searchVolume)}, difficulty ${formatNumber(row.keywordDifficulty)}${row.intent ? `, intent ${row.intent}` : ""}`,
              )
              .join("\n")
          : "No saved keywords yet.";
      const targeted =
        brief.alreadyTargeted.length > 0
          ? brief.alreadyTargeted
              .map(
                (item) =>
                  `- ${item.keyword} (${item.source}${item.url ? `: ${item.url}` : ""})`,
              )
              .join("\n")
          : "None yet.";
      const formats =
        brief.recentFormats.length > 0
          ? brief.recentFormats
              .map(
                (item) =>
                  `- ${item.title}: ${item.format ?? "format not recorded"}`,
              )
              .join("\n")
          : "No previous drafts.";
      const text = [
        brief.workflow,
        "# Project",
        `${brief.project.name} — ${brief.project.domain ?? "no website set"} — market location ${brief.project.locationCode}, language ${brief.project.languageCode}`,
        brief.contextMarkdown,
        "# Search Console striking-distance queries (last 3 months)",
        striking,
        "# Saved keywords",
        saved,
        "# Keywords already targeted by posts or drafts (cannibalization risk)",
        targeted,
        "# Recent post formats (pick a different opener, body shape and table)",
        formats,
        "# Publishing",
        publishing,
      ].join("\n\n");
      return mcpResponse({
        text,
        meta: buildProjectMeta(
          context,
          args.projectId,
          writerPath(args.projectId),
        ),
        structuredContent: {
          workflow: brief.workflow,
          project: brief.project,
          searchConsole: brief.searchConsole,
          savedKeywords: brief.savedKeywords,
          alreadyTargeted: brief.alreadyTargeted,
          recentFormats: brief.recentFormats,
          shopifyConnected: shopify.connected,
        },
      });
    },
  ),
};

const linkInputSchema = {
  projectId: projectIdSchema,
  topic: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe(
      "The post's keyword or topic. Ranks category pages by how well they match it.",
    ),
} as const;

export const getSiteLinkTargetsTool = {
  name: "get_site_link_targets",
  config: {
    title: "Get internal link targets",
    description:
      "List the project website's real category/collection pages, other pages, blog posts and products from its sitemap, ranked by relevance to a topic, plus posts tracked in Blog Tracking. Use it to choose internal links for a blog post. Only link to URLs this tool returns. Uses no credits.",
    inputSchema: linkInputSchema,
    outputSchema: z
      .object({
        origin: z.string(),
        categories: z.array(looseObjectOutputSchema),
        pages: z.array(looseObjectOutputSchema),
        blogPosts: z.array(looseObjectOutputSchema),
        products: z.array(looseObjectOutputSchema),
        trackedPosts: z.array(looseObjectOutputSchema),
        totalDiscovered: z.number(),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof linkInputSchema>>, context) => {
      const targets = await BlogDraftService.getLinkTargets(
        args.projectId,
        args.topic,
      );
      const text = [
        `Link targets for ${targets.origin} (${targets.totalDiscovered} URLs in the sitemap). Most relevant first.`,
        linkSection("Categories / collections", targets.categories, 40),
        linkSection("Pages", targets.pages, 25),
        linkSection("Blog posts", targets.blogPosts, 30),
        linkSection("Products", targets.products, 20),
      ].join("\n\n");
      return mcpResponse({
        text,
        meta: buildProjectMeta(context, args.projectId),
        structuredContent: targets,
      });
    },
  ),
};

const saveInputSchema = {
  projectId: projectIdSchema,
  draftId: z
    .string()
    .optional()
    .describe("Pass to update an existing draft; omit to create a new one."),
  ...blogDraftContentSchema.shape,
  contentHtml: blogDraftContentSchema.shape.contentHtml.describe(
    "The article body as HTML: <h2>/<h3>, <p>, lists, tables, <strong>, <a>. No <h1>, no FAQ (pass it in faqs), no styles or scripts.",
  ),
} as const;

export const saveBlogDraftTool = {
  name: "save_blog_draft",
  config: {
    title: "Save blog draft",
    description:
      "Save a written blog post to the project's Blog Writer in MericSEO, where the user previews it and copies paste-ready HTML (with the FAQ section and FAQ schema). Creates a new draft, or updates one when draftId is passed. Returns the draft link and warns if another post already targets the same keyword. Uses no credits.",
    inputSchema: saveInputSchema,
    outputSchema: z
      .object({
        id: z.string(),
        wordCount: z.number(),
        conflicts: z.array(looseObjectOutputSchema),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof saveInputSchema>>, context) => {
      const { projectId, ...content } = args;
      const result = await BlogDraftService.saveDraft(
        projectId,
        content,
        "mcp",
      );
      const meta = buildProjectMeta(context, projectId, writerPath(projectId), {
        draft: result.id,
      });
      const conflictText =
        result.conflicts.length > 0
          ? `\n\nWarning: "${content.targetKeyword}" is already targeted by ${result.conflicts
              .map((item) => item.url ?? item.title ?? item.source)
              .join(", ")}. Tell the user about the cannibalization risk.`
          : "";
      return mcpResponse({
        text: `Saved draft "${content.title}" (${result.wordCount} words). The user can preview it and copy the HTML here: ${meta.url ?? writerPath(projectId)}${conflictText}`,
        meta,
        structuredContent: result,
      });
    },
  ),
};

const getInputSchema = {
  projectId: projectIdSchema,
  draftId: z.string().min(1),
} as const;

export const getBlogDraftTool = {
  name: "get_blog_draft",
  config: {
    title: "Get blog draft",
    description:
      "Read a saved blog draft (HTML body, meta fields, FAQ, internal links, research notes) so you can revise it. Save changes with save_blog_draft and the same draftId. Uses no credits.",
    inputSchema: getInputSchema,
    outputSchema: z
      .object({
        id: z.string(),
        title: z.string(),
        contentHtml: z.string(),
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
    async (args: z.infer<z.ZodObject<typeof getInputSchema>>, context) => {
      const draft = await BlogDraftService.getDraft(
        args.projectId,
        args.draftId,
      );
      const text = [
        `# ${draft.title}`,
        `Target keyword: ${draft.targetKeyword} | Status: ${draft.status} | ${draft.wordCount} words`,
        `Meta title: ${draft.metaTitle ?? "-"}\nMeta description: ${draft.metaDescription ?? "-"}\nSlug: ${draft.slug ?? "-"}`,
        `Secondary keywords: ${draft.secondaryKeywords.join(", ") || "-"}`,
        "## Body HTML",
        draft.contentHtml,
        "## FAQ",
        draft.faqs
          .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
          .join("\n\n") || "-",
        "## Research notes",
        draft.researchNotes ?? "-",
      ].join("\n\n");
      return mcpResponse({
        text,
        meta: buildProjectMeta(
          context,
          args.projectId,
          writerPath(args.projectId),
          { draft: draft.id },
        ),
        structuredContent: {
          id: draft.id,
          title: draft.title,
          contentHtml: draft.contentHtml,
          targetKeyword: draft.targetKeyword,
          secondaryKeywords: draft.secondaryKeywords,
          metaTitle: draft.metaTitle,
          metaDescription: draft.metaDescription,
          slug: draft.slug,
          excerpt: draft.excerpt,
          faqs: draft.faqs,
          imageSuggestions: draft.imageSuggestions,
          internalLinks: draft.internalLinks,
          researchNotes: draft.researchNotes,
          status: draft.status,
        },
      });
    },
  ),
};
