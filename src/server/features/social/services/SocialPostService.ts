import { AppError } from "@/server/lib/errors";
import { SocialMediaRepository } from "@/server/features/social/repositories/SocialMediaRepository";
import {
  SocialPostRepository,
  type SocialPost,
} from "@/server/features/social/repositories/SocialPostRepository";
import { SocialContextService } from "@/server/features/social/services/SocialContextService";
import { SocialMediaService } from "@/server/features/social/services/SocialMediaService";
import {
  verifySiteUrl,
  withUtm,
} from "@/server/features/social/services/siteUrls";
import type { SocialPostContent } from "@/types/schemas/social";
import type { SocialPostStatus } from "@/shared/social";

const EDITABLE: SocialPostStatus[] = [
  "draft",
  "approved",
  "scheduled",
  "failed",
];

function hashtagText(tags: string[]) {
  return (
    tags
      .map((tag) => tag.trim().replace(/^#+/, "").replace(/\s+/g, ""))
      .filter(Boolean)
      .join("\n") || null
  );
}

async function requireAssets(projectId: string, assetIds: string[]) {
  const unique = [...new Set(assetIds)];
  const assets = await SocialMediaRepository.getMany(projectId, unique);
  if (assets.length !== unique.length)
    throw new AppError(
      "VALIDATION_ERROR",
      "Some media ids are unknown. Save files with save_social_media first.",
    );
  return unique;
}

function validateFormat(content: SocialPostContent) {
  const count = content.mediaAssetIds.length;
  if (content.format === "carousel" && count > 0 && (count < 2 || count > 10))
    throw new AppError("VALIDATION_ERROR", "Carousels need 2–10 media files.");
  if (
    content.format !== "carousel" &&
    count > 1 &&
    content.platform === "instagram"
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Only carousels can have more than one file on Instagram.",
    );
}

async function toValues(
  projectId: string,
  id: string,
  content: SocialPostContent,
) {
  validateFormat(content);
  const linkUrl = content.linkUrl
    ? await verifySiteUrl(projectId, content.linkUrl)
    : null;
  const trackedUrl = linkUrl
    ? withUtm(linkUrl, content.platform, `post-${id}`)
    : null;
  return {
    platform: content.platform,
    format: content.format,
    ideaType: content.ideaType,
    title: content.title,
    hook: content.hook ?? null,
    caption: content.caption,
    hashtags: hashtagText(content.hashtags),
    languageCode: content.languageCode,
    linkUrl,
    trackedUrl,
    storyLinkUrl: content.format === "story" ? trackedUrl : null,
    targetKeyword: content.targetKeyword ?? null,
    sourceType: content.sourceType ?? null,
    sourceTitle: content.sourceTitle ?? null,
    sourceUrl: content.sourceUrl ?? null,
    contextNotes: content.contextNotes ?? null,
    imageBrief: content.imageBrief ?? null,
  };
}

async function save(
  projectId: string,
  content: SocialPostContent & { postId?: string | null },
  createdBy: "user" | "mcp",
) {
  const assetIds = await requireAssets(projectId, content.mediaAssetIds);
  if (content.postId) {
    const existing = await requirePost(projectId, content.postId);
    if (!EDITABLE.includes(existing.status))
      throw new AppError(
        "VALIDATION_ERROR",
        `Post is ${existing.status} and can no longer be edited.`,
      );
    const values = await toValues(projectId, existing.id, content);
    await SocialPostRepository.update(
      projectId,
      existing.id,
      {
        ...values,
        status: "draft",
        approvedAt: null,
        errorMessage: null,
        ...(content.scheduledAt !== undefined
          ? { scheduledAt: content.scheduledAt }
          : {}),
      },
      assetIds,
    );
    await SocialContextService.invalidate(projectId);
    return existing.id;
  }
  const id = crypto.randomUUID();
  const values = await toValues(projectId, id, content);
  const now = new Date().toISOString();
  await SocialPostRepository.create(
    {
      id,
      projectId,
      ...values,
      status: "draft",
      scheduledAt: content.scheduledAt ?? null,
      createdBy,
      createdAt: now,
      updatedAt: now,
    },
    assetIds,
  );
  await SocialContextService.invalidate(projectId);
  return id;
}

async function requirePost(projectId: string, id: string) {
  const post = await SocialPostRepository.get(projectId, id);
  if (!post) throw new AppError("NOT_FOUND", `Post ${id} not found.`);
  return post;
}

async function withMedia(posts: SocialPost[]) {
  const media = await SocialPostRepository.listMedia(
    posts.map((post) => post.id),
  );
  return posts.map((post) => ({
    ...post,
    hashtags: post.hashtags ? post.hashtags.split("\n") : [],
    media: media
      .filter((row) => row.postId === post.id)
      .map((row) => SocialMediaService.toAsset(row.asset)),
  }));
}

async function list(projectId: string, from: string, to: string) {
  const [scheduled, unscheduled] = await Promise.all([
    SocialPostRepository.listRange(projectId, from, to),
    SocialPostRepository.listUnscheduled(projectId),
  ]);
  return {
    scheduled: await withMedia(scheduled),
    unscheduled: await withMedia(unscheduled),
  };
}

async function get(projectId: string, id: string) {
  const [post] = await withMedia([await requirePost(projectId, id)]);
  if (!post) throw new AppError("NOT_FOUND");
  return post;
}

async function approve(projectId: string, ids: string[]) {
  const now = new Date().toISOString();
  const results: {
    id: string;
    status: SocialPostStatus | null;
    error?: string;
  }[] = [];
  for (const id of ids) {
    const post = await SocialPostRepository.get(projectId, id);
    if (!post || !["draft", "failed", "approved"].includes(post.status)) {
      results.push({
        id,
        status: post?.status ?? null,
        error: "Not approvable",
      });
      continue;
    }
    const media = await SocialPostRepository.listMedia([id]);
    if (post.platform === "instagram" && media.length === 0) {
      results.push({
        id,
        status: post.status,
        error: "Instagram posts need an image or video",
      });
      continue;
    }
    const status: SocialPostStatus =
      post.scheduledAt && post.scheduledAt > now ? "scheduled" : "approved";
    await SocialPostRepository.setStatus(
      projectId,
      [id],
      { status, approvedAt: now, errorMessage: null },
      ["draft", "failed", "approved"],
    );
    results.push({ id, status });
  }
  return results;
}

async function unapprove(projectId: string, ids: string[]) {
  const changed = await SocialPostRepository.setStatus(
    projectId,
    ids,
    { status: "draft", approvedAt: null },
    ["approved", "scheduled", "failed"],
  );
  return { changed };
}

async function reschedule(
  projectId: string,
  id: string,
  scheduledAt: string | null,
) {
  const post = await requirePost(projectId, id);
  if (!EDITABLE.includes(post.status))
    throw new AppError("VALIDATION_ERROR", `Post is ${post.status}.`);
  const future = scheduledAt !== null && scheduledAt > new Date().toISOString();
  const status: SocialPostStatus =
    post.status === "approved" || post.status === "scheduled"
      ? future
        ? "scheduled"
        : "approved"
      : post.status;
  await SocialPostRepository.update(projectId, id, { scheduledAt, status });
  return { id, status, scheduledAt };
}

async function attachMedia(
  projectId: string,
  postId: string,
  assetIds: string[],
) {
  const post = await get(projectId, postId);
  if (!EDITABLE.includes(post.status))
    throw new AppError("VALIDATION_ERROR", `Post is ${post.status}.`);
  const ids = await requireAssets(projectId, [
    ...post.media.map((asset) => asset.id),
    ...assetIds,
  ]);
  await SocialPostRepository.update(
    projectId,
    postId,
    { status: "draft", approvedAt: null },
    ids.slice(0, 10),
  );
  return ids.length;
}

async function remove(projectId: string, id: string) {
  const post = await requirePost(projectId, id);
  if (post.status === "publishing")
    throw new AppError("VALIDATION_ERROR", "Post is being published.");
  await SocialPostRepository.remove(projectId, id);
  await SocialContextService.invalidate(projectId);
  return { ok: true as const };
}

export const SocialPostService = {
  save,
  list,
  get,
  approve,
  unapprove,
  reschedule,
  attachMedia,
  remove,
};
