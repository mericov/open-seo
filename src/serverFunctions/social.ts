import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { getPublicOrigin } from "@/server/mcp/public-origin";
import { asAppError } from "@/server/lib/errors";
import { BrandKitService } from "@/server/features/social/services/BrandKitService";
import { MetaConnectionService } from "@/server/features/social/services/MetaConnectionService";
import { SocialContextService } from "@/server/features/social/services/SocialContextService";
import { SocialMediaService } from "@/server/features/social/services/SocialMediaService";
import { SocialPostService } from "@/server/features/social/services/SocialPostService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  connectMetaSchema,
  importSocialMediaSchema,
  listSocialPostsSchema,
  rescheduleSocialPostSchema,
  saveSocialPostSchema,
  socialPostIdSchema,
  socialPostIdsSchema,
  saveBrandKitSchema,
  socialContextSchema,
  socialMediaIdSchema,
  socialProjectSchema,
} from "@/types/schemas/social";

const MAX_UPLOAD_BASE64 = 34_000_000;

async function withSocialMessage<T>(run: () => Promise<T>) {
  try {
    return { ok: true as const, result: await run() };
  } catch (error) {
    const appError = asAppError(error);
    if (appError?.code !== "VALIDATION_ERROR" && appError?.code !== "NOT_FOUND")
      throw error;
    return { ok: false as const, message: appError.message };
  }
}

export const getMetaConnection = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) => ({
    ...(await MetaConnectionService.getConnection(context.projectId)),
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
  }));

export const connectMeta = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(connectMetaSchema)
  .handler(async ({ data, context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return withSocialMessage(() =>
      MetaConnectionService.connect({
        projectId: context.projectId,
        userId: context.userId,
        pageId: data.pageId,
        instagramAccountId: data.instagramAccountId,
        adAccountId: data.adAccountId,
        accessToken: data.accessToken,
        timezone: data.timezone,
      }),
    );
  });

export const testMetaConnection = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) =>
    withSocialMessage(() => MetaConnectionService.test(context.projectId)),
  );

export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return MetaConnectionService.disconnect(context.projectId);
  });

export const getBrandKit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) => BrandKitService.get(context.projectId));

export const saveBrandKit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveBrandKitSchema)
  .handler(async ({ data, context }) => {
    const saved = await BrandKitService.save(context.projectId, data.brandKit);
    await SocialContextService.invalidate(context.projectId);
    return saved;
  });

export const getSocialContext = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialContextSchema)
  .handler(async ({ data, context }) => {
    const socialContext = await SocialContextService.get(context.projectId, {
      refresh: data.refresh,
    });
    return {
      context: socialContext,
      markdown: SocialContextService.render(socialContext),
    };
  });

export const listSocialMedia = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialProjectSchema)
  .handler(async ({ context }) => SocialMediaService.list(context.projectId));

export const importSocialMedia = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(importSocialMediaSchema)
  .handler(async ({ data, context }) =>
    withSocialMessage(() =>
      SocialMediaService.importFromUrl({
        projectId: context.projectId,
        origin: getPublicOrigin(getRequest()),
        url: data.url,
        source: "url",
        label: data.label ?? null,
      }),
    ),
  );

export const uploadSocialMedia = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId: z.string().min(1),
      fileName: z.string().max(300),
      base64: z.string().min(1).max(MAX_UPLOAD_BASE64),
    }),
  )
  .handler(async ({ data, context }) =>
    withSocialMessage(() =>
      SocialMediaService.store({
        projectId: context.projectId,
        origin: getPublicOrigin(getRequest()),
        bytes: Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0)),
        source: "upload",
        sourceUrl: null,
        label: data.fileName,
      }),
    ),
  );

export const deleteSocialMedia = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialMediaIdSchema)
  .handler(async ({ data, context }) =>
    SocialMediaService.remove(context.projectId, data.assetId),
  );

export const listSocialPosts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listSocialPostsSchema)
  .handler(async ({ data, context }) =>
    SocialPostService.list(context.projectId, data.from, data.to),
  );

export const saveSocialPost = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveSocialPostSchema)
  .handler(async ({ data, context }) =>
    withSocialMessage(() =>
      SocialPostService.save(
        context.projectId,
        { ...data.post, postId: data.postId },
        "user",
      ),
    ),
  );

export const approveSocialPosts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialPostIdsSchema)
  .handler(async ({ data, context }) =>
    SocialPostService.approve(context.projectId, data.postIds),
  );

export const unapproveSocialPosts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialPostIdsSchema)
  .handler(async ({ data, context }) =>
    SocialPostService.unapprove(context.projectId, data.postIds),
  );

export const rescheduleSocialPost = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(rescheduleSocialPostSchema)
  .handler(async ({ data, context }) =>
    withSocialMessage(() =>
      SocialPostService.reschedule(
        context.projectId,
        data.postId,
        data.scheduledAt,
      ),
    ),
  );

export const deleteSocialPost = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(socialPostIdSchema)
  .handler(async ({ data, context }) =>
    withSocialMessage(() =>
      SocialPostService.remove(context.projectId, data.postId),
    ),
  );
