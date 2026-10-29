import { z } from "zod";
import { asAppError } from "@/server/lib/errors";
import { SocialPostService } from "@/server/features/social/services/SocialPostService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { SOCIAL_POST_STATUSES } from "@/shared/social";
import { socialPostContentSchema } from "@/types/schemas/social";

const calendarPath = (projectId: string) =>
  `/p/${projectId}/social?tab=calendar`;

function errorText(error: unknown) {
  return (
    asAppError(error)?.message ??
    (error instanceof Error ? error.message : String(error))
  );
}

type ListedPost = Awaited<
  ReturnType<typeof SocialPostService.list>
>["scheduled"][number];

function postLine(post: ListedPost) {
  return `- ${post.id} [${post.status}] ${post.scheduledAt ?? "unscheduled"} ${post.platform}/${post.format} "${post.title}" media=${post.media.length}${post.trackedUrl ? ` link=${post.trackedUrl}` : ""}${post.permalink ? ` live=${post.permalink}` : ""}${post.errorMessage ? ` ERROR: ${post.errorMessage}` : ""}`;
}

const saveInputSchema = {
  projectId: projectIdSchema,
  posts: z
    .array(
      socialPostContentSchema.extend({
        postId: z
          .string()
          .optional()
          .describe(
            "Pass to edit an existing draft (it goes back to draft and needs approval again).",
          ),
      }),
    )
    .min(1)
    .max(30)
    .describe(
      "Post drafts. One platform per post: create two posts to run the same idea on Instagram and Facebook. linkUrl must be a site URL from get_social_context (it is verified, UTM is added). hashtags without #. scheduledAt in UTC ISO (from plan_social_month). mediaAssetIds from save_social_media (can be added later).",
    ),
} as const;

export const saveSocialPostsTool = {
  name: "save_social_posts",
  config: {
    title: "Save social post drafts",
    description:
      "Save or update social post drafts in MericSEO. Each link is checked against the live site and gets UTM tags. Drafts are never published until the user approves them in MericSEO. Returns the saved ids and any per-post errors (fix and resend only those). Uses no credits.",
    inputSchema: saveInputSchema,
    outputSchema: z
      .object({
        saved: z.array(looseObjectOutputSchema),
        errors: z.array(looseObjectOutputSchema),
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
    async (args: z.infer<z.ZodObject<typeof saveInputSchema>>, context) => {
      const saved: { index: number; postId: string; title: string }[] = [];
      const errors: { index: number; title: string; error: string }[] = [];
      for (const [index, post] of args.posts.entries()) {
        try {
          const postId = await SocialPostService.save(
            args.projectId,
            post,
            "mcp",
          );
          saved.push({ index, postId, title: post.title });
        } catch (error) {
          errors.push({ index, title: post.title, error: errorText(error) });
        }
      }
      const meta = buildProjectMeta(
        context,
        args.projectId,
        calendarPath(args.projectId),
      );
      return mcpResponse({
        text: [
          `Saved ${saved.length} draft(s).`,
          ...saved.map((row) => `- #${row.index} ${row.postId}: ${row.title}`),
          ...(errors.length > 0
            ? [
                `Errors (${errors.length}):`,
                ...errors.map(
                  (row) => `- #${row.index} ${row.title}: ${row.error}`,
                ),
              ]
            : []),
          `The user reviews and approves them here: ${meta.url ?? calendarPath(args.projectId)}`,
        ].join("\n"),
        meta,
        structuredContent: { saved, errors },
      });
    },
  ),
};

const scheduleInputSchema = {
  projectId: projectIdSchema,
  items: z
    .array(
      z.object({
        postId: z.string().min(1),
        scheduledAt: z
          .string()
          .datetime({ offset: true })
          .nullable()
          .describe("UTC ISO time, or null to unschedule."),
      }),
    )
    .min(1)
    .max(50),
} as const;

export const scheduleSocialPostsTool = {
  name: "schedule_social_posts",
  config: {
    title: "Schedule social posts",
    description:
      "Set or change the publish time of social posts. This does not approve anything: a draft stays a draft until the user approves it in MericSEO; an already approved post keeps its approval and moves to the new time. Uses no credits.",
    inputSchema: scheduleInputSchema,
    outputSchema: z
      .object({
        results: z.array(looseObjectOutputSchema),
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
    async (args: z.infer<z.ZodObject<typeof scheduleInputSchema>>, context) => {
      const results: { postId: string; status?: string; error?: string }[] = [];
      for (const item of args.items) {
        try {
          const result = await SocialPostService.reschedule(
            args.projectId,
            item.postId,
            item.scheduledAt,
          );
          results.push({ postId: item.postId, status: result.status });
        } catch (error) {
          results.push({ postId: item.postId, error: errorText(error) });
        }
      }
      return mcpResponse({
        text: results
          .map((row) => `- ${row.postId}: ${row.error ?? row.status}`)
          .join("\n"),
        meta: buildProjectMeta(
          context,
          args.projectId,
          calendarPath(args.projectId),
        ),
        structuredContent: { results },
      });
    },
  ),
};

const listInputSchema = {
  projectId: projectIdSchema,
  from: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe("UTC ISO start; defaults to 7 days ago."),
  to: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe("UTC ISO end; defaults to 45 days ahead."),
  status: z.enum(SOCIAL_POST_STATUSES).optional(),
} as const;

export const listSocialPostsTool = {
  name: "list_social_posts",
  config: {
    title: "List social posts",
    description:
      "List a project's social posts in a date range plus unscheduled drafts, with status (draft, approved, scheduled, publishing, published, failed), time, link, media and any error. Uses no credits.",
    inputSchema: listInputSchema,
    outputSchema: z
      .object({
        scheduled: z.array(looseObjectOutputSchema),
        unscheduled: z.array(looseObjectOutputSchema),
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
    async (args: z.infer<z.ZodObject<typeof listInputSchema>>, context) => {
      const from =
        args.from ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
      const to =
        args.to ?? new Date(Date.now() + 45 * 86_400_000).toISOString();
      const result = await SocialPostService.list(args.projectId, from, to);
      const filter = <T extends { status: string }>(rows: T[]) =>
        args.status ? rows.filter((row) => row.status === args.status) : rows;
      const scheduled = filter(result.scheduled);
      const unscheduled = filter(result.unscheduled);
      return mcpResponse({
        text: [
          `Scheduled ${from} → ${to} (${scheduled.length}):`,
          ...scheduled.map(postLine),
          `Unscheduled (${unscheduled.length}):`,
          ...unscheduled.map(postLine),
        ].join("\n"),
        meta: buildProjectMeta(
          context,
          args.projectId,
          calendarPath(args.projectId),
        ),
        structuredContent: { scheduled, unscheduled },
      });
    },
  ),
};
