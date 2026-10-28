import { createServerFn } from "@tanstack/react-start";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { ShopifyBlogService } from "@/server/features/shopify/services/ShopifyBlogService";
import { ShopifyContentService } from "@/server/features/shopify/services/ShopifyContentService";
import { ShopifyService } from "@/server/features/shopify/services/ShopifyService";
import { ShopifyThemeService } from "@/server/features/shopify/services/ShopifyThemeService";
import { asAppError } from "@/server/lib/errors";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  connectShopifySchema,
  createShopifyThemeCopySchema,
  listShopifySeoSchema,
  publishShopifyDraftSchema,
  shopifyDraftSchema,
  shopifyProjectSchema,
  shopifyThemeSchema,
  updateShopifySeoSchema,
} from "@/types/schemas/shopify";

async function withMessage<T>(run: () => Promise<T>) {
  try {
    return { ok: true as const, result: await run() };
  } catch (error) {
    const appError = asAppError(error);
    if (appError?.code !== "VALIDATION_ERROR" && appError?.code !== "NOT_FOUND")
      throw error;
    return { ok: false as const, message: appError.message };
  }
}

export const getShopifyConnection = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(shopifyProjectSchema)
  .handler(async ({ context }) => ({
    ...(await ShopifyService.getConnection(context.projectId)),
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
  }));

export const connectShopify = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(connectShopifySchema)
  .handler(async ({ data, context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return withMessage(() =>
      ShopifyService.connect({
        projectId: context.projectId,
        userId: context.userId,
        shopDomain: data.shopDomain,
        authMode: data.authMode,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        accessToken: data.accessToken,
      }),
    );
  });

export const disconnectShopify = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(shopifyProjectSchema)
  .handler(async ({ context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return ShopifyService.disconnect(context.projectId);
  });

export const getShopifyOverview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(shopifyProjectSchema)
  .handler(async ({ context }) =>
    ShopifyService.getOverview(context.projectId),
  );

export const listShopifySeo = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listShopifySeoSchema)
  .handler(async ({ data, context }) =>
    ShopifyContentService.listSeo(context.projectId, data.resource, {
      search: data.search,
      after: data.after,
    }),
  );

export const updateShopifySeo = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateShopifySeoSchema)
  .handler(async ({ data, context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return withMessage(() =>
      ShopifyContentService.updateSeo(context.projectId, data.updates),
    );
  });

export const listShopifyThemes = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(shopifyProjectSchema)
  .handler(async ({ context }) =>
    ShopifyThemeService.listThemes(context.projectId),
  );

export const createShopifyThemeCopy = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(createShopifyThemeCopySchema)
  .handler(async ({ data, context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return withMessage(() =>
      ShopifyThemeService.createCopy(context.projectId, data.summary),
    );
  });

export const publishShopifyTheme = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(shopifyThemeSchema)
  .handler(async ({ data, context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return withMessage(() =>
      ShopifyThemeService.publishTheme(context.projectId, data.themeId),
    );
  });

export const getShopifyDraftPublishState = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(shopifyDraftSchema)
  .handler(async ({ data, context }) =>
    ShopifyBlogService.getPublishState(context.projectId, data.draftId),
  );

export const publishDraftToShopify = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(publishShopifyDraftSchema)
  .handler(async ({ data, context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    return withMessage(() =>
      ShopifyBlogService.publishDraft(context.projectId, data.draftId, {
        blogId: data.blogId,
        publish: data.publish,
      }),
    );
  });
