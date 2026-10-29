import { z } from "zod";
import {
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
