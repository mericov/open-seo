import { z } from "zod";
import {
  INBOUND_LEAD_STATUSES,
  INBOUND_LEAD_VERDICTS,
} from "@/shared/inboundLeads";

const projectIdShape = { projectId: z.string().min(1) };
const idList = z.array(z.string().min(1)).min(1).max(200);

export const listInboundLeadsSchema = z.object({
  ...projectIdShape,
  verdict: z.enum(INBOUND_LEAD_VERDICTS).optional(),
  status: z.enum(INBOUND_LEAD_STATUSES).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const updateInboundLeadsSchema = z.object({
  ...projectIdShape,
  ids: idList,
  status: z.enum(INBOUND_LEAD_STATUSES).optional(),
  verdict: z.enum(INBOUND_LEAD_VERDICTS).optional(),
});

export const setInboundLeadNoteSchema = z.object({
  ...projectIdShape,
  id: z.string().min(1),
  note: z.string().max(2000),
});

export const removeInboundLeadsSchema = z.object({
  ...projectIdShape,
  ids: idList,
});
