import { createServerFn } from "@tanstack/react-start";
import { BlogTrackingService } from "@/server/features/blog-tracking/services/BlogTrackingService";
import { PageInsightsService } from "@/server/features/blog-tracking/services/PageInsightsService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addBlogPostsSchema,
  blogTrackingReportSchema,
  markPageAlertsSeenSchema,
  pageAdviceRequestSchema,
  pageInsightsSchema,
  removeBlogPostsSchema,
  runPageCheckSchema,
  updateBlogPostSchema,
} from "@/types/schemas/blog-tracking";

export const getBlogTrackingReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(blogTrackingReportSchema)
  .handler(async ({ data, context }) =>
    BlogTrackingService.getReport(context.projectId, data.dateRange),
  );

export const getPageInsights = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(pageInsightsSchema)
  .handler(async ({ data, context }) =>
    PageInsightsService.getInsights(context.projectId, data.id, data.dateRange),
  );

export const generatePageAdvice = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(pageAdviceRequestSchema)
  .handler(async ({ data, context }) =>
    PageInsightsService.generateAdvice(
      context.projectId,
      data.id,
      data.dateRange,
      data.language,
      context,
    ),
  );

export const markPageAlertsSeen = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(markPageAlertsSeenSchema)
  .handler(async ({ data, context }) =>
    BlogTrackingService.markAlertsSeen(context.projectId, data.ids),
  );

export const runPageCheck = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(runPageCheckSchema)
  .handler(async ({ context }) =>
    BlogTrackingService.runCheckNow(context.projectId),
  );

export const addBlogPosts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addBlogPostsSchema)
  .handler(async ({ data, context }) =>
    BlogTrackingService.addPosts(context.projectId, data.posts),
  );

export const updateBlogPost = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateBlogPostSchema)
  .handler(async ({ data, context }) =>
    BlogTrackingService.updatePost(context.projectId, data.id, {
      title: data.title,
      targetKeyword: data.targetKeyword,
      publishedAt: data.publishedAt,
    }),
  );

export const removeBlogPosts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(removeBlogPostsSchema)
  .handler(async ({ data, context }) =>
    BlogTrackingService.removePosts(context.projectId, data.ids),
  );
