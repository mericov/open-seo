import { MetaConnectionRepository } from "@/server/features/social/repositories/MetaConnectionRepository";
import {
  SocialPostRepository,
  type SocialPost,
} from "@/server/features/social/repositories/SocialPostRepository";
import type { SocialMediaAsset } from "@/server/features/social/repositories/SocialMediaRepository";
import { MetaConnectionService } from "@/server/features/social/services/MetaConnectionService";
import {
  graphGet,
  graphPost,
} from "@/server/features/social/services/metaGraph";
import type { MetaConnection } from "@/server/features/social/repositories/MetaConnectionRepository";

const BATCH_LIMIT = 15;
const STUCK_AFTER_MS = 20 * 60_000;
const POLL_INTERVAL_MS = 4_000;
const POLL_ATTEMPTS = 40;

class DeferPublish extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isVideo = (asset: SocialMediaAsset) =>
  asset.contentType.startsWith("video/");

function fullCaption(post: SocialPost, includeLink: boolean) {
  const hashtags = post.hashtags
    ? post.hashtags
        .split("\n")
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        .join(" ")
    : "";
  return [post.caption, includeLink ? post.trackedUrl : null, hashtags]
    .filter(Boolean)
    .join("\n\n");
}

async function waitForContainer(containerId: string, token: string) {
  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    const status = await graphGet<{ status_code?: string; status?: string }>(
      containerId,
      token,
      { fields: "status_code,status" },
    );
    if (status.status_code === "FINISHED" || status.status_code === "PUBLISHED")
      return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED")
      throw new Error(
        `Instagram could not process the media: ${status.status ?? status.status_code}`,
      );
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Instagram is still processing the media after 2 minutes.");
}

async function checkInstagramQuota(igId: string, token: string) {
  const result = await graphGet<{
    data: { quota_usage: number; config?: { quota_total: number } }[];
  }>(`${igId}/content_publishing_limit`, token, {
    fields: "quota_usage,config",
  });
  const row = result.data[0];
  if (row && row.config && row.quota_usage >= row.config.quota_total)
    throw new DeferPublish(
      `Instagram daily publishing limit reached (${row.quota_usage}/${row.config.quota_total}). It will retry automatically.`,
    );
}

async function createIgContainer(
  igId: string,
  token: string,
  params: Record<string, string | boolean | undefined>,
) {
  const created = await graphPost<{ id: string }>(
    `${igId}/media`,
    token,
    params,
  );
  return created.id;
}

async function publishInstagram(
  connection: MetaConnection,
  post: SocialPost,
  media: SocialMediaAsset[],
) {
  const igId = connection.instagramAccountId;
  if (!igId) throw new Error("No Instagram account ID saved for this project.");
  const first = media[0];
  if (!first)
    throw new Error("Instagram posts need at least one image or video.");
  const token = await MetaConnectionService.tokenFor(connection);
  await checkInstagramQuota(igId, token);
  const caption = fullCaption(post, false);
  let containerId: string;
  if (post.format === "story") {
    containerId = await createIgContainer(igId, token, {
      media_type: "STORIES",
      ...(isVideo(first) ? { video_url: first.url } : { image_url: first.url }),
    });
  } else if (post.format === "reel") {
    if (!isVideo(first)) throw new Error("Reels need a video.");
    containerId = await createIgContainer(igId, token, {
      media_type: "REELS",
      video_url: first.url,
      caption,
    });
  } else if (media.length > 1) {
    const children: string[] = [];
    for (const asset of media) {
      const child = await createIgContainer(igId, token, {
        is_carousel_item: true,
        ...(isVideo(asset)
          ? { media_type: "VIDEO", video_url: asset.url }
          : { image_url: asset.url }),
      });
      await waitForContainer(child, token);
      children.push(child);
    }
    containerId = await createIgContainer(igId, token, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
    });
  } else {
    containerId = await createIgContainer(igId, token, {
      ...(isVideo(first)
        ? { media_type: "REELS", video_url: first.url }
        : { image_url: first.url }),
      caption,
    });
  }
  await waitForContainer(containerId, token);
  const published = await graphPost<{ id: string }>(
    `${igId}/media_publish`,
    token,
    {
      creation_id: containerId,
    },
  );
  const details = await graphGet<{ permalink?: string }>(published.id, token, {
    fields: "permalink",
  }).catch(() => ({ permalink: undefined }));
  return { externalId: published.id, permalink: details.permalink ?? null };
}

async function publishFacebook(
  connection: MetaConnection,
  post: SocialPost,
  media: SocialMediaAsset[],
) {
  const pageId = connection.pageId;
  if (!pageId) throw new Error("No Facebook Page ID saved for this project.");
  const token = await MetaConnectionService.pageTokenFor(connection);
  const message = fullCaption(post, true);
  let postId: string;
  const first = media[0];
  if (post.format === "story" && first) {
    if (isVideo(first))
      throw new Error(
        "Facebook video stories are not supported yet; use an image.",
      );
    const photo = await graphPost<{ id: string }>(`${pageId}/photos`, token, {
      url: first.url,
      published: false,
    });
    const story = await graphPost<{ post_id?: string; id?: string }>(
      `${pageId}/photo_stories`,
      token,
      { photo_id: photo.id },
    );
    postId = story.post_id ?? story.id ?? photo.id;
  } else if (first && isVideo(first)) {
    const video = await graphPost<{ id: string }>(`${pageId}/videos`, token, {
      file_url: first.url,
      description: message,
    });
    postId = video.id;
  } else if (media.length > 1) {
    const ids: string[] = [];
    for (const asset of media) {
      const photo = await graphPost<{ id: string }>(`${pageId}/photos`, token, {
        url: asset.url,
        published: false,
      });
      ids.push(photo.id);
    }
    const params: Record<string, string> = { message };
    ids.forEach((id, index) => {
      params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
    });
    const feed = await graphPost<{ id: string }>(
      `${pageId}/feed`,
      token,
      params,
    );
    postId = feed.id;
  } else if (first) {
    const photo = await graphPost<{ id: string; post_id?: string }>(
      `${pageId}/photos`,
      token,
      { url: first.url, message },
    );
    postId = photo.post_id ?? photo.id;
  } else {
    const feed = await graphPost<{ id: string }>(`${pageId}/feed`, token, {
      message: fullCaption(post, false),
      ...(post.trackedUrl ? { link: post.trackedUrl } : {}),
    });
    postId = feed.id;
  }
  const details = await graphGet<{ permalink_url?: string }>(postId, token, {
    fields: "permalink_url",
  }).catch(() => ({ permalink_url: undefined }));
  return { externalId: postId, permalink: details.permalink_url ?? null };
}

async function publishPost(post: SocialPost) {
  const connection = await MetaConnectionRepository.getByProjectId(
    post.projectId,
  );
  if (!connection) throw new Error("Meta is not connected for this project.");
  const media = (await SocialPostRepository.listMedia([post.id])).map(
    (row) => row.asset,
  );
  return post.platform === "instagram"
    ? publishInstagram(connection, post, media)
    : publishFacebook(connection, post, media);
}

async function releaseStuck() {
  const stuck = await SocialPostRepository.listStuckPublishing(
    new Date(Date.now() - STUCK_AFTER_MS).toISOString(),
  );
  for (const row of stuck) {
    await SocialPostRepository.finish(row.id, {
      status: "failed",
      errorMessage:
        "Publishing stopped midway. Check the account before retrying so the post isn't duplicated.",
    });
  }
}

export async function runScheduledSocialPublishing() {
  await releaseStuck();
  const due = await SocialPostRepository.listDue(
    new Date().toISOString(),
    BATCH_LIMIT,
  );
  for (const post of due) {
    if (!(await SocialPostRepository.claim(post.id))) continue;
    try {
      const result = await publishPost(post);
      await SocialPostRepository.finish(post.id, {
        status: "published",
        publishedAt: new Date().toISOString(),
        externalId: result.externalId,
        permalink: result.permalink,
        errorMessage: null,
      });
    } catch (error) {
      const deferred = error instanceof DeferPublish;
      await SocialPostRepository.finish(post.id, {
        status: deferred ? "scheduled" : "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (deferred) continue;
      console.error("[social] publish failed", post.id, error);
    }
  }
}
