import { z } from "zod";
import {
  AD_CTA_TYPES,
  AD_DRAFT_KINDS,
  AD_FORMATS,
  AD_PAGE_KINDS,
  SOCIAL_CONTEXT_SOURCES,
  SOCIAL_IDEA_TYPES,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_FORMATS,
  SOCIAL_TIMEZONES,
} from "@/shared/social";

const projectIdShape = { projectId: z.string().min(1) };

export const socialProjectSchema = z.object(projectIdShape);

const metaIdSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^(act_)?\d*$/, "Use the numeric ID")
  .optional();

export const connectMetaSchema = z.object({
  ...projectIdShape,
  pageId: metaIdSchema,
  instagramAccountId: metaIdSchema,
  adAccountId: metaIdSchema,
  accessToken: z.string().trim().max(1000).optional(),
  timezone: z.enum(SOCIAL_TIMEZONES).optional(),
});

const colorSchema = z
  .string()
  .trim()
  .regex(/^(#[0-9a-fA-F]{6})?$/, "Use a hex color like #1A2B3C")
  .nullish();

export const brandKitInputSchema = z.object({
  tone: z.string().max(2000).nullish(),
  targetAudience: z.string().max(2000).nullish(),
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  accentColor: colorSchema,
  headingFont: z.string().max(100).nullish(),
  bodyFont: z.string().max(100).nullish(),
  logoUrl: z.string().trim().url().max(2048).or(z.literal("")).nullish(),
  bannedPhrases: z.string().max(4000).nullish(),
});

export type BrandKitInput = z.infer<typeof brandKitInputSchema>;

export const saveBrandKitSchema = z.object({
  ...projectIdShape,
  brandKit: brandKitInputSchema,
});

export const socialContextSchema = z.object({
  ...projectIdShape,
  refresh: z.boolean().default(false),
});

export const importSocialMediaSchema = z.object({
  ...projectIdShape,
  url: z.string().trim().url().max(4096),
  label: z.string().trim().max(200).optional(),
});

export const socialMediaIdSchema = z.object({
  ...projectIdShape,
  assetId: z.string().min(1),
});

export const socialPostContentSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  format: z.enum(SOCIAL_POST_FORMATS),
  ideaType: z.enum(SOCIAL_IDEA_TYPES),
  title: z.string().trim().min(1).max(200),
  hook: z.string().trim().max(300).nullish(),
  caption: z.string().trim().min(1).max(2200),
  hashtags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  languageCode: z.string().trim().min(2).max(10),
  linkUrl: z.string().trim().url().max(2048).nullish(),
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
  mediaAssetIds: z.array(z.string().min(1)).max(10).default([]),
  targetKeyword: z.string().trim().max(200).nullish(),
  sourceType: z.enum(SOCIAL_CONTEXT_SOURCES).nullish(),
  sourceTitle: z.string().trim().max(300).nullish(),
  sourceUrl: z.string().trim().url().max(2048).nullish(),
  contextNotes: z.string().trim().max(2000).nullish(),
  imageBrief: z.string().trim().max(2000).nullish(),
});

export type SocialPostContent = z.infer<typeof socialPostContentSchema>;

export const listSocialPostsSchema = z.object({
  ...projectIdShape,
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

export const saveSocialPostSchema = z.object({
  ...projectIdShape,
  postId: z.string().optional(),
  post: socialPostContentSchema,
});

export const socialPostIdsSchema = z.object({
  ...projectIdShape,
  postIds: z.array(z.string().min(1)).min(1).max(100),
});

export const rescheduleSocialPostSchema = z.object({
  ...projectIdShape,
  postId: z.string().min(1),
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
});

export const socialPostIdSchema = z.object({
  ...projectIdShape,
  postId: z.string().min(1),
});

export const adPageInputSchema = z.object({
  pageId: z.string().trim().regex(/^\d+$/, "Use the numeric Facebook page ID"),
  pageName: z.string().trim().min(1).max(200),
  domain: z.string().trim().max(255).nullish(),
  kind: z.enum(AD_PAGE_KINDS).default("competitor"),
});

export const competitorAdInputSchema = z.object({
  libraryId: z.string().trim().regex(/^\d+$/),
  pageId: z.string().trim().regex(/^\d+$/),
  pageName: z.string().trim().min(1).max(200),
  country: z.string().trim().length(2).nullish(),
  snapshotUrl: z.string().url().max(2048),
  headline: z.string().max(500).nullish(),
  body: z.string().max(5000).nullish(),
  description: z.string().max(1000).nullish(),
  cta: z.string().max(100).nullish(),
  format: z.enum(AD_FORMATS).default("unknown"),
  hook: z.string().max(500).nullish(),
  angle: z.string().max(300).nullish(),
  offer: z.string().max(300).nullish(),
  mediaUrl: z.string().url().max(2048).nullish(),
  transcript: z.string().max(10000).nullish(),
  sceneSummary: z.string().max(4000).nullish(),
  startedAt: z.string().datetime({ offset: true }).nullish(),
  stoppedAt: z.string().datetime({ offset: true }).nullish(),
  active: z.boolean(),
});

export const adDraftContentSchema = z.object({
  kind: z.enum(AD_DRAFT_KINDS),
  name: z.string().trim().min(1).max(200),
  angle: z.string().trim().max(300).nullish(),
  script: z.string().trim().max(8000).nullish(),
  cta: z.enum(AD_CTA_TYPES).default("SHOP_NOW"),
  landingUrl: z.string().trim().url().max(2048),
  primaryTexts: z.array(z.string().trim().min(1).max(2000)).min(1).max(5),
  headlines: z.array(z.string().trim().min(1).max(255)).min(1).max(5),
  descriptions: z.array(z.string().trim().min(1).max(255)).max(5).default([]),
  hooks: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  mediaAssetIds: z.array(z.string().min(1)).max(10).default([]),
  targetKeyword: z.string().trim().max(200).nullish(),
  sourceType: z.enum(SOCIAL_CONTEXT_SOURCES).nullish(),
  sourceTitle: z.string().trim().max(300).nullish(),
  sourceUrl: z.string().trim().url().max(2048).nullish(),
  inspiration: z.string().trim().max(2000).nullish(),
  contextNotes: z.string().trim().max(2000).nullish(),
});

export type AdDraftContent = z.infer<typeof adDraftContentSchema>;

export const saveAdDraftSchema = z.object({
  ...projectIdShape,
  draftId: z.string().optional(),
  draft: adDraftContentSchema,
});

export const adDraftIdSchema = z.object({
  ...projectIdShape,
  draftId: z.string().min(1),
});

export const sendAdSchema = z.object({
  ...projectIdShape,
  draftId: z.string().min(1),
  campaignId: z.string().trim().regex(/^\d*$/).optional(),
  dailyBudget: z.number().int().min(1).max(100000).optional(),
  countries: z.array(z.string().length(2)).min(1).max(25).optional(),
});

export const adPagesSchema = z.object({
  ...projectIdShape,
  pages: z.array(adPageInputSchema).min(1).max(30),
});

export const removeAdPageSchema = z.object({
  ...projectIdShape,
  pageId: z.string().min(1),
});
