import { z } from "zod";
import { asAppError } from "@/server/lib/errors";
import { AdArchiveService } from "@/server/features/social/services/AdArchiveService";
import { AdDraftService } from "@/server/features/social/services/AdDraftService";
import { MetaAdsPublisher } from "@/server/features/social/services/MetaAdsPublisher";
import { AD_WORKFLOW } from "@/server/features/social/services/adWorkflow";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import {
  adDraftContentSchema,
  adPageInputSchema,
  competitorAdInputSchema,
} from "@/types/schemas/social";

const adsPath = (projectId: string) => `/p/${projectId}/ads`;
const loose = z.object({ ...optionalMetaOutputSchema }).passthrough();
const annotations = (readOnly: boolean, openWorld = false) => ({
  readOnlyHint: readOnly,
  openWorldHint: openWorld,
  destructiveHint: false,
});

function pageLines(
  pages: Awaited<ReturnType<typeof AdArchiveService.listPages>>,
) {
  return pages.length > 0
    ? pages
        .map(
          (page) =>
            `- ${page.pageName} (page id ${page.pageId}, ${page.kind}${page.domain ? `, ${page.domain}` : ""})`,
        )
        .join("\n")
    : "None yet.";
}

const projectOnly = { projectId: projectIdSchema } as const;

export const startAdStudioTool = {
  name: "start_ad_studio",
  config: {
    title: "Start the ad studio",
    description:
      "Start here for competitor ad research or writing Meta ads. Returns the ad workflow (competitor archive via Meta's free Ad Library connector, tagging, winner signal, report, UGC and static ad drafts, PAUSED-only sending), the project's competitor pages and the current category report. Uses no credits.",
    inputSchema: projectOnly,
    outputSchema: loose,
    annotations: annotations(true),
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof projectOnly>>, context) => {
      const [pages, report] = await Promise.all([
        AdArchiveService.listPages(args.projectId),
        AdArchiveService.report(args.projectId),
      ]);
      return mcpResponse({
        text: [
          AD_WORKFLOW,
          "",
          "## Competitor pages",
          pageLines(pages),
          "",
          AdArchiveService.renderReport(report),
        ].join("\n"),
        meta: buildProjectMeta(
          context,
          args.projectId,
          adsPath(args.projectId),
        ),
        structuredContent: { pages, report },
      });
    },
  ),
};

const pagesInput = {
  projectId: projectIdSchema,
  pages: z.array(adPageInputSchema).min(1).max(30),
} as const;

export const addAdCompetitorPagesTool = {
  name: "add_ad_competitor_pages",
  config: {
    title: "Add competitor ad pages",
    description:
      "Add competitor or similar-brand Facebook pages whose ads the archive tracks. Use the numeric page id from the Meta Ads connector's ads_library_search results. Uses no credits.",
    inputSchema: pagesInput,
    outputSchema: loose,
    annotations: annotations(false),
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof pagesInput>>, context) => {
      const pages = await AdArchiveService.addPages(args.projectId, args.pages);
      return mcpResponse({
        text: `Competitor pages:\n${pageLines(pages)}`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          adsPath(args.projectId),
        ),
        structuredContent: { pages },
      });
    },
  ),
};

const adsInput = {
  projectId: projectIdSchema,
  ads: z
    .array(competitorAdInputSchema)
    .min(1)
    .max(100)
    .describe(
      "Ads from ads_library_search with your tags. Re-saving a libraryId merges: empty fields keep earlier values.",
    ),
} as const;

export const saveCompetitorAdsTool = {
  name: "save_competitor_ads",
  config: {
    title: "Save competitor ads",
    description:
      "Store competitor ads in the project's ad archive without duplicates, with format, hook, angle, offer, CTA, run dates and optional body text, media URL, transcript and scene summary. Ads running 30+ days are flagged as winners. Uses no credits.",
    inputSchema: adsInput,
    outputSchema: loose,
    annotations: annotations(false),
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof adsInput>>, context) => {
      const result = await AdArchiveService.saveAds(args.projectId, args.ads);
      return mcpResponse({
        text: `Saved ${result.saved} ad(s). Call get_competitor_ad_report for the updated summary.`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          adsPath(args.projectId),
        ),
        structuredContent: result,
      });
    },
  ),
};

export const getCompetitorAdReportTool = {
  name: "get_competitor_ad_report",
  config: {
    title: "Competitor ad report",
    description:
      "Summarize the project's competitor ad archive: angles, hooks, offers, formats and CTAs ranked by how many winners (30+ day ads) use them, plus the longest-running ads. Uses no credits.",
    inputSchema: projectOnly,
    outputSchema: loose,
    annotations: annotations(true),
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof projectOnly>>, context) => {
      const report = await AdArchiveService.report(args.projectId);
      return mcpResponse({
        text: AdArchiveService.renderReport(report),
        meta: buildProjectMeta(
          context,
          args.projectId,
          adsPath(args.projectId),
        ),
        structuredContent: report,
      });
    },
  ),
};

const draftInput = {
  projectId: projectIdSchema,
  draftId: z
    .string()
    .optional()
    .describe(
      "Pass to edit an existing draft (it returns to draft and needs approval again).",
    ),
  draft: adDraftContentSchema,
} as const;

export const saveAdDraftTool = {
  name: "save_ad_draft",
  config: {
    title: "Save an ad draft",
    description:
      "Save a UGC or static Meta ad draft: script, hook variations, 1–5 primary texts, headlines and descriptions, a CTA type, media from save_social_media, and a landing URL on the site (verified, UTM added). The user approves drafts in MericSEO; nothing is sent to Meta from here. Uses no credits.",
    inputSchema: draftInput,
    outputSchema: z
      .object({ draftId: z.string(), ...optionalMetaOutputSchema })
      .passthrough(),
    annotations: annotations(false, true),
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof draftInput>>, context) => {
      const draftId = await AdDraftService.save(
        args.projectId,
        { ...args.draft, draftId: args.draftId },
        "mcp",
      );
      const meta = buildProjectMeta(
        context,
        args.projectId,
        adsPath(args.projectId),
      );
      return mcpResponse({
        text: `Saved ad draft ${draftId}. The user reviews and approves it here: ${meta.url ?? adsPath(args.projectId)}`,
        meta,
        structuredContent: { draftId },
      });
    },
  ),
};

export const listAdDraftsTool = {
  name: "list_ad_drafts",
  config: {
    title: "List ad drafts",
    description:
      "List the project's ad drafts with status (draft, approved, sent, failed), copy variations, media, landing URL and Meta ids. Uses no credits.",
    inputSchema: projectOnly,
    outputSchema: z
      .object({
        drafts: z.array(looseObjectOutputSchema),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: annotations(true),
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof projectOnly>>, context) => {
      const drafts = await AdDraftService.list(args.projectId);
      return mcpResponse({
        text:
          drafts.length > 0
            ? drafts
                .map(
                  (draft) =>
                    `- ${draft.id} [${draft.status}] ${draft.kind}: ${draft.name} → ${draft.landingUrl}${draft.errorMessage ? ` ERROR: ${draft.errorMessage}` : ""}`,
                )
                .join("\n")
            : "No ad drafts yet.",
        meta: buildProjectMeta(
          context,
          args.projectId,
          adsPath(args.projectId),
        ),
        structuredContent: { drafts },
      });
    },
  ),
};

const sendInput = {
  projectId: projectIdSchema,
  draftId: z.string().min(1),
  campaignId: z
    .string()
    .regex(/^\d*$/)
    .optional()
    .describe(
      "Existing campaign to use; omitted = a new PAUSED traffic campaign.",
    ),
  dailyBudget: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "Ad set daily budget in the account currency (the ad set stays PAUSED).",
    ),
  countries: z.array(z.string().length(2)).optional(),
} as const;

export const sendAdToMetaTool = {
  name: "send_ad_to_meta",
  config: {
    title: "Send an approved ad to Meta as PAUSED",
    description:
      "Create an approved ad draft in Meta Ads Manager: campaign (new or existing), ad set, creative and ad, all with status PAUSED. Refuses drafts the user has not approved. Nothing runs or spends until the user activates it in Meta.",
    inputSchema: sendInput,
    outputSchema: loose,
    annotations: annotations(false, true),
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof sendInput>>, context) => {
      try {
        const result = await MetaAdsPublisher.send(args);
        return mcpResponse({
          text: `Created in Meta as PAUSED: campaign ${result.metaCampaignId}, ad set ${result.metaAdSetId}, ad ${result.metaAdId}. Review it in Ads Manager: ${result.adsManagerUrl}`,
          meta: buildProjectMeta(
            context,
            args.projectId,
            adsPath(args.projectId),
          ),
          structuredContent: result,
        });
      } catch (error) {
        return mcpResponse({
          text: `Sending failed: ${asAppError(error)?.message ?? String(error)}`,
          meta: buildProjectMeta(
            context,
            args.projectId,
            adsPath(args.projectId),
          ),
          structuredContent: { failed: true },
        });
      }
    },
  ),
};
