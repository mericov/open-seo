import { z } from "zod";
import {
  MEDIA_CONTACT_ROLES,
  MEDIA_OUTLET_TYPES,
  PR_GAP_MAX_COMPETITORS,
  PR_LANGUAGES,
  PR_MARKETS,
  PR_TARGET_SOURCES,
  PR_TARGET_STATUSES,
} from "@/shared/digitalPr";

const projectIdShape = { projectId: z.string().min(1) };
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idList = z.array(z.string().min(1)).min(1).max(500);

const PR_PAGE_SIZE_MAX = 200;
export const PR_PITCH_MAX_IDS = 40;

const paging = {
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(PR_PAGE_SIZE_MAX).default(50),
};

export const prProjectSchema = z.object(projectIdShape);

export const runGapSchema = z.object({
  ...projectIdShape,
  competitors: z
    .array(z.string().trim().min(3).max(200))
    .min(1)
    .max(PR_GAP_MAX_COMPETITORS),
});

export const gapRunSchema = z.object({
  ...projectIdShape,
  runId: z.string().min(1),
});

export const listGapDomainsSchema = z.object({
  ...projectIdShape,
  runId: z.string().min(1),
  minCompetitors: z
    .number()
    .int()
    .min(1)
    .max(PR_GAP_MAX_COMPETITORS)
    .default(1),
  maxSpam: z.number().min(0).max(100).nullable().default(30),
  ...paging,
});

export const gapDomainsActionSchema = z.object({
  ...projectIdShape,
  runId: z.string().min(1),
  gapDomainIds: idList,
});

export const setGapHiddenSchema = gapDomainsActionSchema.extend({
  hidden: z.boolean(),
});

export const addTopicsSchema = z.object({
  ...projectIdShape,
  keywords: z.array(z.string().trim().min(2).max(80)).min(1).max(30),
  market: z.enum(PR_MARKETS),
});

export const topicIdSchema = z.object({
  ...projectIdShape,
  topicId: z.string().min(1),
});

export const setMediaScheduleSchema = z.object({
  ...projectIdShape,
  autoRun: z.boolean(),
});

export const listOutletsSchema = z.object({
  ...projectIdShape,
  market: z.enum(PR_MARKETS).optional(),
  type: z.enum(MEDIA_OUTLET_TYPES).optional(),
  topicId: z.string().min(1).optional(),
  query: z.string().trim().max(100).optional(),
  hasEmail: z.boolean().optional(),
  showHidden: z.boolean().optional(),
  minTraffic: z.number().int().min(0).optional(),
  ...paging,
});

export const addOutletSchema = z.object({
  ...projectIdShape,
  domain: z.string().trim().min(3).max(200),
  market: z.enum(PR_MARKETS),
  type: z.enum(MEDIA_OUTLET_TYPES),
});

export const updateOutletSchema = z.object({
  ...projectIdShape,
  outletId: z.string().min(1),
  name: z.string().trim().max(120).nullable(),
  type: z.enum(MEDIA_OUTLET_TYPES),
  market: z.enum(PR_MARKETS),
  notes: z.string().trim().max(2000).nullable(),
});

export const outletIdsSchema = z.object({
  ...projectIdShape,
  outletIds: idList,
});

export const setOutletsHiddenSchema = outletIdsSchema.extend({
  hidden: z.boolean(),
});

export const saveContactSchema = z.object({
  ...projectIdShape,
  outletId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  name: z.string().trim().max(120).nullable(),
  email: z.email().max(254).nullable(),
  jobTitle: z.string().trim().max(120).nullable(),
  role: z.enum(MEDIA_CONTACT_ROLES),
});

export const setContactHiddenSchema = z.object({
  ...projectIdShape,
  contactId: z.string().min(1),
  hidden: z.boolean(),
});

export const addMediaToListSchema = z
  .object({
    ...projectIdShape,
    outletIds: z.array(z.string().min(1)).max(500).default([]),
    contactIds: z.array(z.string().min(1)).max(500).default([]),
  })
  .refine((data) => data.outletIds.length + data.contactIds.length > 0, {
    message: "Pick at least one outlet or contact.",
  });

export const listTargetsSchema = z.object({
  ...projectIdShape,
  status: z.enum(PR_TARGET_STATUSES).optional(),
  source: z.enum(PR_TARGET_SOURCES).optional(),
  dueBy: isoDate.optional(),
  hasEmail: z.boolean().optional(),
  today: isoDate.optional(),
  ...paging,
});

export const setTargetStatusSchema = z.object({
  ...projectIdShape,
  targetIds: idList,
  status: z.enum(PR_TARGET_STATUSES),
});

export const targetIdSchema = z.object({
  ...projectIdShape,
  targetId: z.string().min(1),
});

export const targetIdsSchema = z.object({
  ...projectIdShape,
  targetIds: idList,
});

export const generatePitchesSchema = z.object({
  ...projectIdShape,
  targetIds: z.array(z.string().min(1)).min(1).max(PR_PITCH_MAX_IDS),
});

export const setPitchSchema = z.object({
  ...projectIdShape,
  targetId: z.string().min(1),
  pitch: z.string().max(2000),
});

export const setTargetNoteSchema = z.object({
  ...projectIdShape,
  targetId: z.string().min(1),
  noteText: z.string().max(2000),
  remindAt: isoDate.nullable(),
});

export const saveTemplateSchema = z.object({
  ...projectIdShape,
  templateId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(80),
  language: z.enum(PR_LANGUAGES),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

export const templateIdSchema = z.object({
  ...projectIdShape,
  templateId: z.string().min(1),
});
