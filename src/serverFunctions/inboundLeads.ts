import { createServerFn } from "@tanstack/react-start";
import { InboundLeadService } from "@/server/features/inbound-leads/services/InboundLeadService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  listInboundLeadsSchema,
  removeInboundLeadsSchema,
  setInboundLeadNoteSchema,
  updateInboundLeadsSchema,
} from "@/types/schemas/inboundLeads";

export const listInboundLeads = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listInboundLeadsSchema)
  .handler(async ({ data, context }) =>
    InboundLeadService.list(
      context.projectId,
      { verdict: data.verdict, status: data.status },
      { page: data.page, pageSize: data.pageSize },
    ),
  );

export const updateInboundLeads = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateInboundLeadsSchema)
  .handler(async ({ data, context }) =>
    InboundLeadService.update(context.projectId, data.ids, {
      status: data.status,
      verdict: data.verdict,
    }),
  );

export const setInboundLeadNote = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setInboundLeadNoteSchema)
  .handler(async ({ data, context }) =>
    InboundLeadService.update(context.projectId, [data.id], {
      note: data.note.trim() || null,
    }),
  );

export const removeInboundLeads = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(removeInboundLeadsSchema)
  .handler(async ({ data, context }) =>
    InboundLeadService.remove(context.projectId, data.ids),
  );
