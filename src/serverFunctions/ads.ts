import { createServerFn } from "@tanstack/react-start";
import { asAppError } from "@/server/lib/errors";
import { AdArchiveService } from "@/server/features/social/services/AdArchiveService";
import { AdDraftService } from "@/server/features/social/services/AdDraftService";
import { MetaAdsPublisher } from "@/server/features/social/services/MetaAdsPublisher";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  adDraftIdSchema,
  adPagesSchema,
  removeAdPageSchema,
  saveAdDraftSchema,
  sendAdSchema,
  socialMediaIdSchema,
  socialProjectSchema,
} from "@/types/schemas/social";

async function withMessage<T>(run: () => Promise<T>) {
  try {
    return { ok: true as const, result: await run() };
  } catch (error) {
    const appError = asAppError(error);
    if (appError?.code !== "VALIDATION_ERROR" && appError?.code !== "NOT_FOUND")
      throw error;
    return { ok: false as const, message: appError.message };
  }
}

export const listAdPages = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) =>
    AdArchiveService.listPages(context.projectId),
  );

export const addAdPages = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(adPagesSchema)
  .handler(async ({ data, context }) =>
    AdArchiveService.addPages(context.projectId, data.pages),
  );

export const removeAdPage = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(removeAdPageSchema)
  .handler(async ({ data, context }) =>
    AdArchiveService.removePage(context.projectId, data.pageId),
  );

export const listCompetitorAds = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) => AdArchiveService.listAds(context.projectId));

export const deleteCompetitorAd = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialMediaIdSchema)
  .handler(async ({ data, context }) =>
    AdArchiveService.removeAd(context.projectId, data.assetId),
  );

export const getAdReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) => {
    const report = await AdArchiveService.report(context.projectId);
    return { report, markdown: AdArchiveService.renderReport(report) };
  });

export const listAdDrafts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) => AdDraftService.list(context.projectId));

export const saveAdDraft = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveAdDraftSchema)
  .handler(async ({ data, context }) =>
    withMessage(() =>
      AdDraftService.save(
        context.projectId,
        { ...data.draft, draftId: data.draftId },
        "user",
      ),
    ),
  );

export const approveAdDraft = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(adDraftIdSchema)
  .handler(async ({ data, context }) =>
    withMessage(() => AdDraftService.approve(context.projectId, data.draftId)),
  );

export const unapproveAdDraft = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(adDraftIdSchema)
  .handler(async ({ data, context }) =>
    withMessage(() =>
      AdDraftService.unapprove(context.projectId, data.draftId),
    ),
  );

export const deleteAdDraft = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(adDraftIdSchema)
  .handler(async ({ data, context }) =>
    withMessage(() => AdDraftService.remove(context.projectId, data.draftId)),
  );

export const sendAdDraft = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(sendAdSchema)
  .handler(async ({ data, context }) =>
    withMessage(() =>
      MetaAdsPublisher.send({
        projectId: context.projectId,
        draftId: data.draftId,
        campaignId: data.campaignId || undefined,
        dailyBudget: data.dailyBudget,
        countries: data.countries,
      }),
    ),
  );
