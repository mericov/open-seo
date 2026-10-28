import { createServerFn } from "@tanstack/react-start";
import { TrafficHistoryService } from "@/server/features/traffic-history/services/TrafficHistoryService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addTrafficNoteSchema,
  deleteTrafficNoteSchema,
  extendTrafficHistorySchema,
  trafficHistoryMarketSchema,
} from "@/types/schemas/trafficHistory";

function marketFor(
  data: { domain: string; locationCode?: number },
  context: {
    organizationId: string;
    project: { locationCode: number; languageCode: string };
  },
) {
  return TrafficHistoryService.resolveMarket({
    organizationId: context.organizationId,
    project: context.project,
    domain: data.domain,
    locationCode: data.locationCode,
  });
}

export const getTrafficHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trafficHistoryMarketSchema)
  .handler(async ({ data, context }) =>
    TrafficHistoryService.getView(marketFor(data, context)),
  );

export const ensureTrafficHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trafficHistoryMarketSchema)
  .handler(async ({ data, context }) =>
    TrafficHistoryService.ensure(marketFor(data, context), context),
  );

export const extendTrafficHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(extendTrafficHistorySchema)
  .handler(async ({ data, context }) =>
    TrafficHistoryService.extend(marketFor(data, context), data.range, context),
  );

export const refreshTrafficHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trafficHistoryMarketSchema)
  .handler(async ({ data, context }) =>
    TrafficHistoryService.refresh(marketFor(data, context), context),
  );

export const addTrafficNote = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addTrafficNoteSchema)
  .handler(async ({ data, context }) =>
    TrafficHistoryService.addNote(
      marketFor(data, context),
      data.month,
      data.body,
    ),
  );

export const deleteTrafficNote = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(deleteTrafficNoteSchema)
  .handler(async ({ data, context }) =>
    TrafficHistoryService.deleteNote(marketFor(data, context), data.noteId),
  );
