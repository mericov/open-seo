import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import {
  SOCIAL_TABS,
  SocialStudioPage,
} from "@/client/features/social/SocialStudioPage";

const searchSchema = z.object({
  tab: z.enum(SOCIAL_TABS).default("setup").catch("setup"),
});

export const Route = createFileRoute("/_app/p/$projectId/social")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "setup" })] },
  component: SocialRoute,
});

function SocialRoute() {
  const { projectId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <SocialStudioPage
      projectId={projectId}
      tab={tab}
      onTabChange={(next) => {
        void navigate({ search: { tab: next }, replace: true });
      }}
    />
  );
}
