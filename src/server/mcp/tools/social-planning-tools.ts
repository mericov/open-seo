import { z } from "zod";
import { SocialContextService } from "@/server/features/social/services/SocialContextService";
import { SocialPostService } from "@/server/features/social/services/SocialPostService";
import { holidaysFor } from "@/server/features/social/services/holidays";
import { loadBlogSource } from "@/server/features/social/services/socialSources";
import { SOCIAL_WORKFLOW } from "@/server/features/social/services/socialWorkflow";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { utcToZoned, zonedToUtcIso } from "@/shared/socialTime";

const calendarPath = (projectId: string) =>
  `/p/${projectId}/social?tab=calendar`;

const FORMAT_SIZES = {
  feed_square: "1080×1080 (1:1)",
  feed_portrait: "1080×1350 (4:5)",
  carousel: "1080×1350 (4:5) per slide, all slides the same ratio",
  story: "1080×1920 (9:16)",
  reel: "1080×1920 (9:16) video, 5–90 s",
} as const;

const SLOT_DAYS = [2, 4, 6, 0, 3, 5, 1];

const ideasInputSchema = {
  projectId: projectIdSchema,
  draftId: z
    .string()
    .optional()
    .describe("A MericSEO blog draft id (see get_social_context)."),
  url: z
    .string()
    .url()
    .optional()
    .describe(
      "A blog article URL on the project's site (from get_social_context).",
    ),
} as const;

export const socialIdeasFromBlogTool = {
  name: "social_ideas_from_blog",
  config: {
    title: "Social post ideas from a blog post",
    description:
      "Returns one blog article's text, target keyword and images (from a MericSEO draft or the live site) plus the social workflow, so you can turn it into several post ideas (different angles, each with a type label). Call get_social_context first. Save the ideas you and the user like with save_social_posts. Uses no credits.",
    inputSchema: ideasInputSchema,
    outputSchema: z
      .object({ title: z.string(), ...optionalMetaOutputSchema })
      .passthrough(),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof ideasInputSchema>>, context) => {
      const source = await loadBlogSource(args.projectId, args);
      return mcpResponse({
        text: [
          `# Blog source: ${source.title}`,
          `URL: ${source.url ?? "not published yet (link to a related collection or product instead)"}`,
          `Target keyword: ${source.targetKeyword ?? "unknown"}`,
          `Images in the article: ${source.images.join(" ") || "none"}`,
          "",
          source.text,
          "",
          "Turn this into 3–6 post ideas with different angles (tip, myth, checklist, question, product tie-in). Give each a type label, format, hook, the URL it links to and the image you plan to use. Show them to the user, then save the chosen ones with save_social_posts (sourceType blog_promo or informative, sourceUrl = the article URL).",
          "",
          SOCIAL_WORKFLOW,
        ].join("\n"),
        meta: buildProjectMeta(
          context,
          args.projectId,
          calendarPath(args.projectId),
        ),
        structuredContent: source,
      });
    },
  ),
};

const planInputSchema = {
  projectId: projectIdSchema,
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .describe("Month to plan, YYYY-MM."),
  postsPerWeek: z.number().int().min(1).max(14).default(3),
  postTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("19:00")
    .describe("Default local posting time in the project's time zone."),
} as const;

export const planSocialMonthTool = {
  name: "plan_social_month",
  config: {
    title: "Plan a month of social posts",
    description:
      "Start here to plan a month of Instagram/Facebook posts. Returns the social workflow, the market's special days (TR or US, from the project's market), posts already planned that month, and suggested time slots converted to UTC from the project's time zone. Call get_social_context first, then build the plan and save it with save_social_posts. Uses no credits.",
    inputSchema: planInputSchema,
    outputSchema: z
      .object({
        holidays: z.array(looseObjectOutputSchema),
        slots: z.array(looseObjectOutputSchema),
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
    async (args: z.infer<z.ZodObject<typeof planInputSchema>>, context) => {
      const socialContext = await SocialContextService.get(args.projectId);
      const timezone = socialContext.project.timezone;
      const holidays = holidaysFor(socialContext.project.market, args.month);
      const [year = 0, month = 1] = args.month.split("-").map(Number);
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const wanted = new Set(
        SLOT_DAYS.slice(0, Math.min(7, args.postsPerWeek)),
      );
      const slots = Array.from({ length: daysInMonth }, (_, index) => {
        const day = `${args.month}-${String(index + 1).padStart(2, "0")}`;
        return { day, weekday: new Date(`${day}T12:00:00Z`).getUTCDay() };
      })
        .filter((slot) => wanted.has(slot.weekday))
        .map((slot) => ({
          localDay: slot.day,
          localTime: args.postTime,
          scheduledAt: zonedToUtcIso(slot.day, args.postTime, timezone),
        }));
      const existing = await SocialPostService.list(
        args.projectId,
        zonedToUtcIso(`${args.month}-01`, "00:00", timezone),
        zonedToUtcIso(`${args.month}-${daysInMonth}`, "23:59", timezone),
      );
      const text = [
        `# Plan for ${args.month} (${socialContext.project.market} market, time zone ${timezone})`,
        "## Special days",
        holidays
          .map(
            (row) =>
              `- ${row.date}: ${row.name}${row.note ? ` (${row.note})` : ""}`,
          )
          .join("\n") || "None this month.",
        "## Already planned",
        existing.scheduled
          .map(
            (post) =>
              `- ${post.scheduledAt ? utcToZoned(post.scheduledAt, timezone).day : "?"} [${post.status}] ${post.platform}/${post.format}: ${post.title}`,
          )
          .join("\n") || "Nothing yet.",
        `Unscheduled drafts: ${existing.unscheduled.length}`,
        "## Suggested slots (local → scheduledAt UTC)",
        slots
          .map(
            (slot) =>
              `- ${slot.localDay} ${slot.localTime} → ${slot.scheduledAt}`,
          )
          .join("\n"),
        "Move a seasonal post onto or a few days before its special day. Use the exact scheduledAt strings above (or convert other local times to UTC the same way).",
        "",
        SOCIAL_WORKFLOW,
      ].join("\n");
      return mcpResponse({
        text,
        meta: buildProjectMeta(
          context,
          args.projectId,
          calendarPath(args.projectId),
        ),
        structuredContent: {
          timezone,
          holidays,
          slots,
          alreadyPlanned: existing.scheduled.length,
        },
      });
    },
  ),
};

const prepareInputSchema = {
  projectId: projectIdSchema,
  postId: z.string().min(1),
} as const;

export const prepareSocialImageTool = {
  name: "prepare_social_image",
  config: {
    title: "Prepare a social post image",
    description:
      "Returns what a post's image needs: target size for its format, the brand kit (colors, fonts, logo), the post's hook and caption, and candidate images from the site (the linked product's images first). Use it before Higgsfield reframe/outpaint (9:16 stories) or image generation, then store the result with save_social_media and postId. Uses no credits; Higgsfield does, so confirm cost with the user first.",
    inputSchema: prepareInputSchema,
    outputSchema: z
      .object({ postId: z.string(), ...optionalMetaOutputSchema })
      .passthrough(),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof prepareInputSchema>>, context) => {
      const [post, socialContext] = await Promise.all([
        SocialPostService.get(args.projectId, args.postId),
        SocialContextService.get(args.projectId),
      ]);
      const linked = [post.linkUrl, post.sourceUrl].filter(Boolean);
      const productImages = socialContext.site.products
        .filter((product) => linked.includes(product.url))
        .flatMap((product) => product.images);
      const otherImages = [
        ...socialContext.site.articles
          .filter((row) => linked.includes(row.url))
          .map((row) => row.image),
        ...socialContext.site.collections
          .filter((row) => linked.includes(row.url))
          .map((row) => row.image),
        ...socialContext.site.products.flatMap((product) =>
          product.images.slice(0, 1),
        ),
      ].filter((url): url is string => Boolean(url));
      const candidates = [...new Set([...productImages, ...otherImages])].slice(
        0,
        15,
      );
      const kit = socialContext.brand.kit;
      const text = [
        `# Image brief for post ${post.id}: ${post.title}`,
        `Format: ${post.format}, size ${FORMAT_SIZES[post.format]}`,
        `Hook / headline: ${post.hook ?? post.title}`,
        `Image brief: ${post.imageBrief ?? "none"}`,
        `Brand colors: ${[kit?.primaryColor, kit?.secondaryColor, kit?.accentColor].filter(Boolean).join(", ") || "not set"}; fonts: ${[kit?.headingFont, kit?.bodyFont].filter(Boolean).join(" / ") || "not set"}; logo: ${kit?.logoUrl ?? "none"}`,
        `Already attached: ${post.media.map((asset) => asset.url).join(" ") || "nothing"}`,
        "## Candidate site images (use these as the base)",
        candidates.map((url) => `- ${url}`).join("\n") ||
          "None found; ask the user for an image.",
        "",
        post.format === "story" || post.format === "reel"
          ? "For 9:16: run Higgsfield reframe (aspect 9:16) or outpaint on the best candidate, keep the product unchanged, leave the top and bottom 250 px free of key content for the UI and link sticker."
          : "For 1:1 / 4:5: a site image can be saved as is (MericSEO's composer adds the text layer), or generate a variant with Higgsfield using the site image as reference.",
        "Tell the user the Higgsfield credit cost and wait for a yes before generating. Then call save_social_media with source higgsfield (or shopify for an unedited site image) and postId.",
      ].join("\n");
      return mcpResponse({
        text,
        meta: buildProjectMeta(
          context,
          args.projectId,
          calendarPath(args.projectId),
        ),
        structuredContent: {
          postId: post.id,
          format: post.format,
          size: FORMAT_SIZES[post.format],
          candidates,
        },
      });
    },
  ),
};
