import { z } from "zod";
import {
  LEAD_FINDING_CODES,
  LEAD_NOTE_COLORS,
  LEAD_OUTREACH_STATUSES,
} from "@/shared/leadFindings";
import { LEAD_AREA_COUNTRIES } from "@/shared/leadAreas";
import { LEAD_MAIL_STEPS } from "@/shared/leadFollowUp";
import {
  LEAD_CATEGORY_GROUP_KEYS,
  LEAD_NEED_FILTERS,
  LEAD_RUN_SIZE_MAX,
  LEAD_STORE_PLATFORMS,
} from "@/shared/leadScan";

const projectIdShape = { projectId: z.string().min(1) };

export const LEAD_SEARCH_MAX_LIMIT = 100;

export const leadLocationQuerySchema = z.object({
  ...projectIdShape,
  query: z.string().trim().min(2).max(200),
});

export const importStoresSchema = z.object({
  ...projectIdShape,
  domains: z.string().trim().min(3).max(20_000),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LEAD_LIST_MAX_PAGE_SIZE = 2000;
export const LEAD_STATUS_MAX_IDS = 500;

export const listProjectLeadsSchema = z.object({
  ...projectIdShape,
  status: z.enum(LEAD_OUTREACH_STATUSES).optional(),
  source: z.enum(["local", "shopify"]).optional(),
  searchId: z.string().min(1).optional(),
  hasEmail: z.boolean().optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  dueBy: isoDate.optional(),
  finding: z.enum(LEAD_FINDING_CODES).optional(),
  today: isoDate.optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(LEAD_LIST_MAX_PAGE_SIZE).default(50),
});

export const setLeadHiddenSchema = z.object({
  ...projectIdShape,
  leadIds: z.array(z.string().min(1)).min(1).max(LEAD_STATUS_MAX_IDS),
  hidden: z.boolean(),
});

export const LEAD_RESCAN_MAX_IDS = 2;

export const rescanLeadsSchema = z.object({
  ...projectIdShape,
  leadIds: z.array(z.string().min(1)).min(1).max(LEAD_RESCAN_MAX_IDS),
});

export const setLeadNoteSchema = z.object({
  ...projectIdShape,
  leadId: z.string().min(1),
  color: z.enum(LEAD_NOTE_COLORS).nullable(),
  text: z.string().max(2000),
  remindAt: isoDate.nullable(),
});

export const setLeadStatusSchema = z.object({
  ...projectIdShape,
  leadIds: z.array(z.string().min(1)).min(1).max(LEAD_STATUS_MAX_IDS),
  status: z.enum(LEAD_OUTREACH_STATUSES),
});

export const LEAD_FIRST_LINE_MAX_IDS = 50;

export const generateFirstLinesSchema = z.object({
  ...projectIdShape,
  leadIds: z.array(z.string().min(1)).min(1).max(LEAD_FIRST_LINE_MAX_IDS),
});

export const updateFirstLineSchema = z.object({
  ...projectIdShape,
  leadId: z.string().min(1),
  firstLine: z.string().max(400),
});

export const saveLeadTemplateSchema = z.object({
  ...projectIdShape,
  templateId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(80),
  language: z.enum(["tr", "en"]),
  step: z.union(LEAD_MAIL_STEPS.map((step) => z.literal(step))).default(1),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

export const listLeadFollowUpsSchema = z.object({
  ...projectIdShape,
  today: isoDate,
});

export const recordLeadMailSchema = z.object({
  ...projectIdShape,
  leadId: z.string().min(1),
  step: z.union(LEAD_MAIL_STEPS.map((step) => z.literal(step))),
});

export const leadIdSchema = z.object({
  ...projectIdShape,
  leadId: z.string().min(1),
});

export const saveLeadFindingPhraseSchema = z.object({
  ...projectIdShape,
  code: z.enum(LEAD_FINDING_CODES),
  language: z.enum(["tr", "en"]),
  text: z.string().trim().max(300),
});

export const leadTemplateIdSchema = z.object({
  ...projectIdShape,
  templateId: z.string().min(1),
});

export const saveLeadReportSchema = z.object({
  ...projectIdShape,
  leadId: z.string().min(1),
  html: z.string().min(100).max(3_000_000),
});

export const setLeadScheduleSchema = z.object({
  ...projectIdShape,
  searchId: z.string().min(1),
  autoRun: z.boolean(),
  runSize: z.number().int().min(1).max(LEAD_RUN_SIZE_MAX),
});

export const leadSearchIdSchema = z.object({
  ...projectIdShape,
  searchId: z.string().min(1),
});

export const listLeadSearchesSchema = z.object(projectIdShape);

const campaignAreaSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("country"),
    countryCode: z.enum(LEAD_AREA_COUNTRIES),
  }),
  z.object({
    scope: z.literal("place"),
    place: z.object({
      label: z.string().trim().min(1).max(300),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    radiusKm: z.number().int().min(1).max(100),
  }),
]);

const campaignPoolShape = {
  ...projectIdShape,
  weeklyTarget: z.number().int().min(5).max(LEAD_RUN_SIZE_MAX),
  autoRun: z.boolean(),
};

export const createLeadCampaignSchema = z.discriminatedUnion("preset", [
  z.object({
    ...campaignPoolShape,
    preset: z.literal("product_b2b"),
    area: campaignAreaSchema,
  }),
  z.object({
    ...campaignPoolShape,
    preset: z.literal("local_service"),
    categoryGroup: z.enum(LEAD_CATEGORY_GROUP_KEYS),
    needFilter: z.enum(LEAD_NEED_FILTERS).optional(),
    area: campaignAreaSchema,
  }),
  z.object({
    ...campaignPoolShape,
    preset: z.literal("shopify_service"),
    technology: z.enum(LEAD_STORE_PLATFORMS).default("Shopify"),
    countryCode: z.enum(LEAD_AREA_COUNTRIES),
    keywords: z.array(z.string().trim().min(1).max(60)).max(10),
    maxRank: z.number().int().min(0).max(1000).optional(),
  }),
]);

export type CreateLeadCampaignInput = z.infer<typeof createLeadCampaignSchema>;

export const suppressLeadsSchema = z.object({
  ...projectIdShape,
  leadIds: z.array(z.string().min(1)).min(1).max(LEAD_STATUS_MAX_IDS),
});
