export const SOCIAL_PLATFORMS = ["instagram", "facebook"] as const;

export const SOCIAL_POST_STATUSES = [
  "draft",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "failed",
] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const SOCIAL_POST_FORMATS = [
  "feed_square",
  "feed_portrait",
  "carousel",
  "story",
  "reel",
] as const;

export const SOCIAL_IDEA_TYPES = [
  "informative",
  "fun",
  "product",
  "seasonal",
  "blog_promo",
] as const;

export const SOCIAL_CONTEXT_SOURCES = [
  "blog",
  "product",
  "collection",
  "page",
  "search_query",
  "holiday",
  "other",
] as const;

export const SOCIAL_MEDIA_SOURCES = [
  "upload",
  "url",
  "higgsfield",
  "shopify",
] as const;
export type SocialMediaSource = (typeof SOCIAL_MEDIA_SOURCES)[number];

export const SOCIAL_TIMEZONES = [
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "UTC",
] as const;

export const META_GRAPH_VERSION = "v24.0";

export const META_REQUIRED_PERMISSIONS = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_manage_posts",
  "pages_read_engagement",
  "ads_read",
  "ads_management",
] as const;

export const TURKEY_LOCATION_CODE = 2792;

export function defaultTimezone(locationCode: number) {
  return locationCode === TURKEY_LOCATION_CODE
    ? "Europe/Istanbul"
    : "America/New_York";
}

export const SOCIAL_MEDIA_PATH_PREFIX = "/social-media/";
