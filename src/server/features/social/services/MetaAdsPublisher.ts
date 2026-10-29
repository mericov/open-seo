import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { AdDraftRepository } from "@/server/features/social/repositories/AdDraftRepository";
import { AdDraftService } from "@/server/features/social/services/AdDraftService";
import { MetaConnectionService } from "@/server/features/social/services/MetaConnectionService";
import {
  adAccountPath,
  graphGet,
  graphPost,
} from "@/server/features/social/services/metaGraph";
import { TURKEY_LOCATION_CODE } from "@/shared/social";

const PAUSED = "PAUSED";
const POLL_MS = 5_000;
const POLL_ATTEMPTS = 18;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Asset = { r2Key: string; url: string; contentType: string };

function defaultBudget(currency: string) {
  if (currency === "TRY") return 300;
  if (currency === "JPY" || currency === "KRW") return 1500;
  return 10;
}

function toMinorUnits(amount: number, currency: string) {
  return ["JPY", "KRW"].includes(currency) ? amount : amount * 100;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function uploadImage(account: string, token: string, asset: Asset) {
  const object = await env.R2.get(asset.r2Key);
  if (!object)
    throw new AppError("VALIDATION_ERROR", `Media file missing: ${asset.url}`);
  const bytes = new Uint8Array(await object.arrayBuffer());
  const result = await graphPost<{ images: Record<string, { hash: string }> }>(
    `${account}/adimages`,
    token,
    { bytes: bytesToBase64(bytes) },
  );
  const hash = Object.values(result.images)[0]?.hash;
  if (!hash)
    throw new AppError("VALIDATION_ERROR", "Meta returned no image hash.");
  return hash;
}

async function uploadVideo(account: string, token: string, asset: Asset) {
  const video = await graphPost<{ id: string }>(`${account}/advideos`, token, {
    file_url: asset.url,
  });
  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    const thumbnails = await graphGet<{
      data: { uri: string; is_preferred?: boolean }[];
    }>(`${video.id}/thumbnails`, token).catch(() => ({ data: [] }));
    const preferred =
      thumbnails.data.find((row) => row.is_preferred) ?? thumbnails.data[0];
    if (preferred) return { videoId: video.id, thumbnailUrl: preferred.uri };
    await sleep(POLL_MS);
  }
  throw new AppError(
    "VALIDATION_ERROR",
    "Meta is still processing the video. Try sending again in a few minutes.",
  );
}

async function buildAssetFeed(
  account: string,
  token: string,
  draft: Awaited<ReturnType<typeof AdDraftService.get>>,
) {
  const { media } = await AdDraftRepository.listChildren([draft.id]);
  const assets = media.map((row) => row.asset);
  const videos = assets.filter((asset) =>
    asset.contentType.startsWith("video/"),
  );
  const images = assets.filter(
    (asset) => !asset.contentType.startsWith("video/"),
  );
  const assetFeed: Record<string, unknown> = {
    bodies: draft.primaryTexts.map((text) => ({ text })),
    titles: draft.headlines.map((text) => ({ text })),
    descriptions: draft.descriptions.map((text) => ({ text })),
    link_urls: [{ website_url: draft.trackedUrl }],
    call_to_action_types: [draft.cta],
  };
  if (videos.length > 0) {
    const uploaded = [];
    for (const video of videos.slice(0, 5))
      uploaded.push(await uploadVideo(account, token, video));
    assetFeed.videos = uploaded.map((row) => ({
      video_id: row.videoId,
      thumbnail_url: row.thumbnailUrl,
    }));
    assetFeed.ad_formats = ["SINGLE_VIDEO"];
    return assetFeed;
  }
  const hashes = [];
  for (const image of images.slice(0, 10))
    hashes.push(await uploadImage(account, token, image));
  assetFeed.images = hashes.map((hash) => ({ hash }));
  assetFeed.ad_formats = ["SINGLE_IMAGE"];
  return assetFeed;
}

async function send(input: {
  projectId: string;
  draftId: string;
  campaignId?: string;
  dailyBudget?: number;
  countries?: string[];
}) {
  const draft = await AdDraftService.get(input.projectId, input.draftId);
  if (draft.status !== "approved" && draft.status !== "failed")
    throw new AppError(
      "VALIDATION_ERROR",
      "Approve the ad before sending it to Meta.",
    );
  if (draft.status === "failed" && !draft.approvedAt)
    throw new AppError(
      "VALIDATION_ERROR",
      "Approve the ad before sending it to Meta.",
    );
  const connection = await MetaConnectionService.requireConnection(
    input.projectId,
  );
  if (!connection.adAccountId || !connection.pageId)
    throw new AppError(
      "VALIDATION_ERROR",
      "Save the ad account ID and Facebook Page ID in the Meta connection first.",
    );
  const project = await ProjectRepository.getProjectById(input.projectId);
  const token = await MetaConnectionService.tokenFor(connection);
  const account = adAccountPath(connection.adAccountId);
  const ids = {
    metaCampaignId: draft.metaCampaignId,
    metaAdSetId: draft.metaAdSetId,
    metaCreativeId: draft.metaCreativeId,
    metaAdId: draft.metaAdId,
  };
  const remember = (values: Partial<typeof ids>) => {
    Object.assign(ids, values);
    return AdDraftRepository.update(input.projectId, draft.id, values);
  };
  try {
    const { currency } = await graphGet<{ currency: string }>(account, token, {
      fields: "currency",
    });
    const countries = input.countries ?? [
      project?.locationCode === TURKEY_LOCATION_CODE ? "TR" : "US",
    ];
    const label = `MericSEO · ${draft.name}`.slice(0, 200);

    if (input.campaignId && !ids.metaCampaignId)
      await remember({ metaCampaignId: input.campaignId });
    if (!ids.metaCampaignId) {
      const campaign = await graphPost<{ id: string }>(
        `${account}/campaigns`,
        token,
        {
          name: label,
          objective: "OUTCOME_TRAFFIC",
          status: PAUSED,
          special_ad_categories: "[]",
          is_adset_budget_sharing_enabled: false,
        },
      );
      await remember({ metaCampaignId: campaign.id });
    }
    if (!ids.metaAdSetId) {
      const adSet = await graphPost<{ id: string }>(
        `${account}/adsets`,
        token,
        {
          name: label,
          campaign_id: ids.metaCampaignId ?? "",
          status: PAUSED,
          daily_budget: toMinorUnits(
            input.dailyBudget ?? defaultBudget(currency),
            currency,
          ),
          billing_event: "IMPRESSIONS",
          optimization_goal: "LINK_CLICKS",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          destination_type: "WEBSITE",
          is_dynamic_creative: true,
          targeting: JSON.stringify({
            geo_locations: { countries },
            age_min: 18,
            age_max: 65,
            targeting_automation: { advantage_audience: 1 },
          }),
        },
      );
      await remember({ metaAdSetId: adSet.id });
    }
    if (!ids.metaCreativeId) {
      const assetFeed = await buildAssetFeed(account, token, draft);
      const creative = await graphPost<{ id: string }>(
        `${account}/adcreatives`,
        token,
        {
          name: label,
          object_story_spec: JSON.stringify({
            page_id: connection.pageId,
            ...(connection.instagramAccountId
              ? { instagram_user_id: connection.instagramAccountId }
              : {}),
          }),
          asset_feed_spec: JSON.stringify(assetFeed),
        },
      );
      await remember({ metaCreativeId: creative.id });
    }
    if (!ids.metaAdId) {
      const ad = await graphPost<{ id: string }>(`${account}/ads`, token, {
        name: label,
        adset_id: ids.metaAdSetId ?? "",
        creative: JSON.stringify({ creative_id: ids.metaCreativeId }),
        status: PAUSED,
      });
      await remember({ metaAdId: ad.id });
    }
    await AdDraftRepository.update(input.projectId, draft.id, {
      status: "sent",
      sentAt: new Date().toISOString(),
      errorMessage: null,
    });
  } catch (error) {
    await AdDraftRepository.update(input.projectId, draft.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  return {
    ...ids,
    adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${connection.adAccountId}&selected_ad_ids=${ids.metaAdId ?? ""}`,
  };
}

export const MetaAdsPublisher = { send };
