import { createServerFn } from "@tanstack/react-start";
import { LeadFinderService } from "@/server/features/leads/services/LeadFinderService";
import { StoreFinderService } from "@/server/features/leads/services/StoreFinderService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  leadCategoryQuerySchema,
  leadLocationQuerySchema,
  importStoresSchema,
  leadSearchIdSchema,
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
