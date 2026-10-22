import { PrTemplateRepository } from "@/server/features/digital-pr/repositories/PrTemplateRepository";
import { createServerFn } from "@tanstack/react-start";
import { CompetitorGapService } from "@/server/features/digital-pr/services/CompetitorGapService";
import { MediaEnrichService } from "@/server/features/digital-pr/services/MediaEnrichService";
import { MediaLibraryService } from "@/server/features/digital-pr/services/MediaLibraryService";
import { MediaScanService } from "@/server/features/digital-pr/services/MediaScanService";
import { PrOutreachService } from "@/server/features/digital-pr/services/PrOutreachService";
import { PrPitchService } from "@/server/features/digital-pr/services/PrPitchService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addMediaToListSchema,
  addOutletSchema,
  addTopicsSchema,
  gapDomainsActionSchema,
  gapRunSchema,
  generatePitchesSchema,
  listGapDomainsSchema,
  listOutletsSchema,
  listTargetsSchema,
  outletIdsSchema,
  prProjectSchema,
  runGapSchema,
  saveContactSchema,
  saveTemplateSchema,
  setContactHiddenSchema,
  setGapHiddenSchema,
  setMediaScheduleSchema,
  setOutletsHiddenSchema,
  setPitchSchema,
  setTargetNoteSchema,
  setTargetStatusSchema,
  targetIdSchema,
  targetIdsSchema,
  templateIdSchema,
  topicIdSchema,
  updateOutletSchema,
} from "@/types/schemas/digitalPr";

export const getGapSetup = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(prProjectSchema)
  .handler(async ({ context }) => ({
    ownDomain: context.project.domain,
    suggested: await CompetitorGapService.suggestCompetitors(context.projectId),
    runs: await CompetitorGapService.listRuns(context.projectId),
  }));

export const runCompetitorGap = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(runGapSchema)
  .handler(async ({ data, context }) =>
    CompetitorGapService.run(context.project, data.competitors, context),
  );

export const getCompetitorGap = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listGapDomainsSchema)
  .handler(async ({ data, context }) =>
    CompetitorGapService.getRun(
      context.projectId,
      context.organizationId,
      data.runId,
      { minCompetitors: data.minCompetitors, maxSpam: data.maxSpam },
      { page: data.page, pageSize: data.pageSize },
    ),
  );

export const addGapDomainsToList = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(gapDomainsActionSchema)
  .handler(async ({ data, context }) =>
    CompetitorGapService.addToList(
      context.project,
      context.organizationId,
      data.runId,
      data.gapDomainIds,
    ),
  );

export const setGapDomainsHidden = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setGapHiddenSchema)
  .handler(async ({ data, context }) =>
    CompetitorGapService.setHidden(
      context.projectId,
      data.runId,
      data.gapDomainIds,
      data.hidden,
    ),
  );

export const deleteCompetitorGap = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(gapRunSchema)
  .handler(async ({ data, context }) =>
    CompetitorGapService.deleteRun(context.projectId, data.runId),
  );

export const getMediaOverview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(prProjectSchema)
  .handler(async ({ context }) =>
    MediaScanService.getOverview(context.organizationId),
  );

export const addMediaTopics = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addTopicsSchema)
  .handler(async ({ data, context }) =>
    MediaScanService.addTopics(
      context.organizationId,
      data.keywords,
      data.market,
    ),
  );

export const deleteMediaTopic = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(topicIdSchema)
  .handler(async ({ data, context }) =>
    MediaScanService.deleteTopic(context.organizationId, data.topicId),
  );

export const setMediaSchedule = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setMediaScheduleSchema)
  .handler(async ({ data, context }) =>
    MediaScanService.setSchedule(context.organizationId, data.autoRun),
  );

export const runMediaScan = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(prProjectSchema)
  .handler(async ({ context }) =>
    MediaScanService.runScan(context.organizationId, "manual", context),
  );

export const enrichMediaBatch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(prProjectSchema)
  .handler(async ({ context }) =>
    MediaEnrichService.enrichNext(context.organizationId),
  );

export const listMediaOutlets = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listOutletsSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.listOutlets(
      context.organizationId,
      context.projectId,
      {
        market: data.market,
        type: data.type,
        topicId: data.topicId,
        query: data.query,
        hasEmail: data.hasEmail,
        showHidden: data.showHidden,
        minTraffic: data.minTraffic,
      },
      { page: data.page, pageSize: data.pageSize },
    ),
  );

export const addMediaOutlet = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addOutletSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.addOutlet(context.organizationId, {
      domain: data.domain,
      market: data.market,
      type: data.type,
    }),
  );

export const updateMediaOutlet = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateOutletSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.updateOutlet(context.organizationId, data.outletId, {
      name: data.name,
      type: data.type,
      market: data.market,
      notes: data.notes,
    }),
  );

export const setMediaOutletsHidden = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setOutletsHiddenSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.setOutletsHidden(
      context.organizationId,
      data.outletIds,
      data.hidden,
    ),
  );

export const rescanMediaOutlets = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(outletIdsSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.rescanOutlets(context.organizationId, data.outletIds),
  );

export const saveMediaContact = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveContactSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.saveContact(context.organizationId, {
      outletId: data.outletId,
      contactId: data.contactId,
      name: data.name,
      email: data.email,
      jobTitle: data.jobTitle,
      role: data.role,
    }),
  );

export const setMediaContactHidden = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setContactHiddenSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.setContactHidden(
      context.organizationId,
      data.contactId,
      data.hidden,
    ),
  );

export const addMediaToList = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addMediaToListSchema)
  .handler(async ({ data, context }) =>
    MediaLibraryService.addToList(context.organizationId, context.projectId, {
      outletIds: data.outletIds,
      contactIds: data.contactIds,
    }),
  );

export const listPrTargets = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listTargetsSchema)
  .handler(async ({ data, context }) =>
    PrOutreachService.listTargets(
      context.project,
      context.organizationId,
      {
        status: data.status,
        source: data.source,
        dueBy: data.dueBy,
        hasEmail: data.hasEmail,
        today: data.today,
      },
      { page: data.page, pageSize: data.pageSize },
    ),
  );

export const setPrTargetStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setTargetStatusSchema)
  .handler(async ({ data, context }) =>
    PrOutreachService.setStatus(context.projectId, data.targetIds, data.status),
  );

export const markPrTargetSent = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(targetIdSchema)
  .handler(async ({ data, context }) =>
    PrOutreachService.markSent(context.projectId, data.targetId),
  );

export const setPrTargetNote = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setTargetNoteSchema)
  .handler(async ({ data, context }) =>
    PrOutreachService.setNote(context.projectId, data.targetId, {
      noteText: data.noteText,
      remindAt: data.remindAt,
    }),
  );

export const setPrTargetPitch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setPitchSchema)
  .handler(async ({ data, context }) =>
    PrOutreachService.setPitch(context.projectId, data.targetId, data.pitch),
  );

export const removePrTargets = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(targetIdsSchema)
  .handler(async ({ data, context }) =>
    PrOutreachService.removeTargets(context.projectId, data.targetIds),
  );

export const generatePrPitches = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(generatePitchesSchema)
  .handler(async ({ data, context }) =>
    PrPitchService.generate(context.project, data.targetIds, context),
  );

export const listPrTemplates = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(prProjectSchema)
  .handler(async ({ context }) =>
    PrTemplateRepository.listTemplates(context.projectId),
  );

export const savePrTemplate = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveTemplateSchema)
  .handler(async ({ data, context }) => ({
    templateId: await PrTemplateRepository.saveTemplate(
      context.projectId,
      data.templateId,
      {
        name: data.name,
        language: data.language,
        subject: data.subject,
        body: data.body,
      },
    ),
  }));

export const deletePrTemplate = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(templateIdSchema)
  .handler(async ({ data, context }) =>
    PrTemplateRepository.deleteTemplate(context.projectId, data.templateId),
  );
