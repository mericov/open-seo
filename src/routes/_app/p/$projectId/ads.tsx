import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { AD_TABS, AdStudioPage } from "@/client/features/ads/AdStudioPage";

const searchSchema = z.object({
  tab: z.enum(AD_TABS).default("drafts").catch("drafts"),
});

export const Route = createFileRoute("/_app/p/$projectId/ads")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "drafts" })] },
  component: AdsRoute,
});

function AdsRoute() {
  const { projectId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <AdStudioPage
      projectId={projectId}
      tab={tab}
      onTabChange={(next) => {
        void navigate({ search: { tab: next }, replace: true });
      }}
    />
  );
}
