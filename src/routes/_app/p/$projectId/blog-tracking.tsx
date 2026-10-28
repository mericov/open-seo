import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { BlogTrackingPage } from "@/client/features/blog-tracking/BlogTrackingPage";
import {
  BLOG_TRACKING_RANGES,
  BLOG_TRACKING_VIEWS,
} from "@/types/schemas/blog-tracking";

const searchSchema = z.object({
  range: z
    .enum(BLOG_TRACKING_RANGES)
    .default("last_28_days")
    .catch("last_28_days"),
  view: z.enum(BLOG_TRACKING_VIEWS).default("blog").catch("blog"),
  open: z.string().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/p/$projectId/blog-tracking")({
  validateSearch: searchSchema,
  search: {
    middlewares: [stripSearchParams({ range: "last_28_days", view: "blog" })],
  },
  component: BlogTrackingRoute,
});

function BlogTrackingRoute() {
  const { projectId } = Route.useParams();
  const { range, view, open } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <BlogTrackingPage
      projectId={projectId}
      dateRange={range}
      view={view}
      openId={open ?? null}
      onDateRangeChange={(next) => {
        void navigate({
          search: (prev) => ({ ...prev, range: next }),
          replace: true,
        });
      }}
      onViewChange={(next) => {
        void navigate({
          search: (prev) => ({ ...prev, view: next }),
          replace: true,
        });
      }}
    />
  );
}
