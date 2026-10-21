import { createServerFn } from "@tanstack/react-start";
import { LeadFinderService } from "@/server/features/leads/services/LeadFinderService";
import { LeadFirstLineService } from "@/server/features/leads/services/LeadFirstLineService";
import { LeadScanService } from "@/server/features/leads/services/LeadScanService";
import { LeadTemplateRepository } from "@/server/features/leads/repositories/LeadTemplateRepository";
import { LeadOutreachService } from "@/server/features/leads/services/LeadOutreachService";
import { StoreFinderService } from "@/server/features/leads/services/StoreFinderService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  leadCategoryQuerySchema,
  leadLocationQuerySchema,
  generateFirstLinesSchema,
  importStoresSchema,
  updateFirstLineSchema,
  leadSearchIdSchema,
  leadTemplateIdSchema,
  saveLeadTemplateSchema,
  listProjectLeadsSchema,
  setLeadScheduleSchema,
  setLeadStatusSchema,
  listLeadSearchesSchema,
  startLeadSearchSchema,
  startStoreSearchSchema,
} from "@/types/schemas/leads";

export const listLeadCategories = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadCategoryQuerySchema)
  .handler(async ({ data }) =>
    LeadFinderService.listCategories(data.query, 20),
  );

export const findLeadLocations = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadLocationQuerySchema)
  .handler(async ({ data }) => LeadFinderService.findLocations(data.query));

export const listLeadSearches = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listLeadSearchesSchema)
  .handler(async ({ context }) =>
    LeadFinderService.listSearches(context.projectId),
  );

export const startLeadSearch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(startLeadSearchSchema)
  .handler(async ({ data, context }) =>
    LeadFinderService.startSearch(
      {
        projectId: context.projectId,
        category: data.category,
        categoryGroup: data.categoryGroup,
        needFilter: data.needFilter,
        nameQuery: data.nameQuery,
        location: data.location,
        place: data.place,
        radiusKm: data.radiusKm,
        limit: data.limit,
        minRating: data.minRating,
      },
      context,
    ),
  );

export const startStoreSearch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(startStoreSearchSchema)
  .handler(async ({ data, context }) =>
    StoreFinderService.startStoreSearch(
      {
        projectId: context.projectId,
        technology: data.technology,
        keywords: data.keywords,
        countryCode: data.countryCode,
        maxRank: data.maxRank,
        limit: data.limit,
      },
      context,
    ),
  );

export const importStores = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(importStoresSchema)
  .handler(async ({ data, context }) =>
    StoreFinderService.importStores(context.projectId, data.domains),
  );

export const enrichLeadBatch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadSearchIdSchema)
  .handler(async ({ data, context }) =>
    LeadFinderService.enrichNextBatch(context.projectId, data.searchId),
  );

export const getLeadSearch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadSearchIdSchema)
  .handler(async ({ data, context }) =>
    LeadFinderService.getSearchDetail(context.projectId, data.searchId),
  );

export const deleteLeadSearch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadSearchIdSchema)
  .handler(async ({ data, context }) =>
    LeadFinderService.deleteSearch(context.projectId, data.searchId),
  );

export const listProjectLeads = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listProjectLeadsSchema)
  .handler(async ({ data, context }) =>
    LeadOutreachService.listLeads(
      context.projectId,
      {
        status: data.status,
        source: data.source,
        searchId: data.searchId,
        hasEmail: data.hasEmail,
        minScore: data.minScore,
      },
      { page: data.page, pageSize: data.pageSize },
    ),
  );

export const setLeadStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setLeadStatusSchema)
  .handler(async ({ data, context }) =>
    LeadOutreachService.setStatus(context.projectId, data.leadIds, data.status),
  );

export const runLeadSearchNow = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadSearchIdSchema)
  .handler(async ({ data, context }) =>
    LeadScanService.runNow(context.projectId, data.searchId, context),
  );

export const setLeadSchedule = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setLeadScheduleSchema)
  .handler(async ({ data, context }) =>
    LeadScanService.setSchedule(context.projectId, data.searchId, {
      autoRun: data.autoRun,
      runSize: data.runSize,
    }),
  );

export const generateLeadFirstLines = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(generateFirstLinesSchema)
  .handler(async ({ data, context }) =>
    LeadFirstLineService.generate(context.projectId, data.leadIds, context),
  );

export const updateLeadFirstLine = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateFirstLineSchema)
  .handler(async ({ data, context }) =>
    LeadFirstLineService.update(context.projectId, data.leadId, data.firstLine),
  );

export const retryFailedLeads = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadSearchIdSchema)
  .handler(async ({ data, context }) =>
    LeadFinderService.retryFailed(context.projectId, data.searchId),
  );

export const listLeadTemplates = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listLeadSearchesSchema)
  .handler(async ({ context }) =>
    LeadTemplateRepository.list(context.projectId),
  );

export const saveLeadTemplate = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveLeadTemplateSchema)
  .handler(async ({ data, context }) => {
    const input = {
      name: data.name,
      language: data.language,
      subject: data.subject,
      body: data.body,
    };
    if (data.templateId) {
      await LeadTemplateRepository.update(
        context.projectId,
        data.templateId,
        input,
      );
      return { id: data.templateId };
    }
    return {
      id: await LeadTemplateRepository.create(context.projectId, input),
    };
  });

export const deleteLeadTemplate = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(leadTemplateIdSchema)
  .handler(async ({ data, context }) =>
    LeadTemplateRepository.remove(context.projectId, data.templateId),
  );
