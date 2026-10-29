import { AppError } from "@/server/lib/errors";
import {
  AdDraftRepository,
  type AdDraft,
} from "@/server/features/social/repositories/AdDraftRepository";
import { SocialMediaRepository } from "@/server/features/social/repositories/SocialMediaRepository";
import { SocialContextService } from "@/server/features/social/services/SocialContextService";
import { SocialMediaService } from "@/server/features/social/services/SocialMediaService";
import {
  verifySiteUrl,
  withUtm,
} from "@/server/features/social/services/siteUrls";
import type { AdDraftContent } from "@/types/schemas/social";

function variations(content: AdDraftContent) {
  return [
    ...content.primaryTexts.map((value) => ({
      field: "primary_text" as const,
      value,
    })),
    ...content.headlines.map((value) => ({
      field: "headline" as const,
      value,
    })),
    ...content.descriptions.map((value) => ({
      field: "description" as const,
      value,
    })),
    ...content.hooks.map((value) => ({ field: "hook" as const, value })),
  ];
}

async function requireDraft(projectId: string, id: string) {
  const draft = await AdDraftRepository.get(projectId, id);
  if (!draft) throw new AppError("NOT_FOUND", `Ad draft ${id} not found.`);
  return draft;
}

async function save(
  projectId: string,
  content: AdDraftContent & { draftId?: string | null },
  createdBy: "user" | "mcp",
) {
  const assetIds = [...new Set(content.mediaAssetIds)];
  const assets = await SocialMediaRepository.getMany(projectId, assetIds);
  if (assets.length !== assetIds.length)
    throw new AppError("VALIDATION_ERROR", "Some media ids are unknown.");
  const landingUrl = await verifySiteUrl(projectId, content.landingUrl);
  const values = {
    kind: content.kind,
    name: content.name,
    angle: content.angle ?? null,
    script: content.script ?? null,
    cta: content.cta,
    landingUrl,
    targetKeyword: content.targetKeyword ?? null,
    sourceType: content.sourceType ?? null,
    sourceTitle: content.sourceTitle ?? null,
    sourceUrl: content.sourceUrl ?? null,
    inspiration: content.inspiration ?? null,
    contextNotes: content.contextNotes ?? null,
  };
  if (content.draftId) {
    const existing = await requireDraft(projectId, content.draftId);
    if (existing.status === "sent")
      throw new AppError(
        "VALIDATION_ERROR",
        "This ad is already in Meta; create a new draft instead.",
      );
    await AdDraftRepository.replace(
      projectId,
      existing.id,
      {
        ...values,
        trackedUrl: withUtm(
          landingUrl,
          "facebook",
          `ad-${existing.id}`,
          "paid_social",
        ),
        status: "draft",
        approvedAt: null,
        errorMessage: null,
      },
      variations(content),
      assetIds,
    );
    await SocialContextService.invalidate(projectId);
    return existing.id;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await AdDraftRepository.create(
    {
      id,
      projectId,
      ...values,
      trackedUrl: withUtm(landingUrl, "facebook", `ad-${id}`, "paid_social"),
      status: "draft",
      createdBy,
      createdAt: now,
      updatedAt: now,
    },
    variations(content),
    assetIds,
  );
  await SocialContextService.invalidate(projectId);
  return id;
}

async function withChildren(drafts: AdDraft[]) {
  const { variations: rows, media } = await AdDraftRepository.listChildren(
    drafts.map((draft) => draft.id),
  );
  return drafts.map((draft) => {
    const pick = (field: string) =>
      rows
        .filter((row) => row.draftId === draft.id && row.field === field)
        .map((row) => row.value);
    return {
      ...draft,
      primaryTexts: pick("primary_text"),
      headlines: pick("headline"),
      descriptions: pick("description"),
      hooks: pick("hook"),
      media: media
        .filter((row) => row.draftId === draft.id)
        .map((row) => SocialMediaService.toAsset(row.asset)),
    };
  });
}

async function list(projectId: string) {
  return withChildren(await AdDraftRepository.list(projectId, 200));
}

async function get(projectId: string, id: string) {
  const [draft] = await withChildren([await requireDraft(projectId, id)]);
  if (!draft) throw new AppError("NOT_FOUND");
  return draft;
}

async function approve(projectId: string, id: string) {
  const draft = await get(projectId, id);
  if (draft.status !== "draft" && draft.status !== "failed")
    throw new AppError("VALIDATION_ERROR", `Ad is ${draft.status}.`);
  if (draft.media.length === 0)
    throw new AppError(
      "VALIDATION_ERROR",
      "Add an image or video before approving.",
    );
  await AdDraftRepository.update(projectId, id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    errorMessage: null,
  });
  return get(projectId, id);
}

async function unapprove(projectId: string, id: string) {
  const draft = await requireDraft(projectId, id);
  if (draft.status === "sent")
    throw new AppError("VALIDATION_ERROR", "Ad is already in Meta.");
  await AdDraftRepository.update(projectId, id, {
    status: "draft",
    approvedAt: null,
  });
  return get(projectId, id);
}

async function remove(projectId: string, id: string) {
  await requireDraft(projectId, id);
  await AdDraftRepository.remove(projectId, id);
  return { ok: true as const };
}

export const AdDraftService = { save, list, get, approve, unapprove, remove };
