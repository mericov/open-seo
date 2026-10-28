import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { ShopifyPage } from "@/client/features/shopify/ShopifyPage";

const searchSchema = z.object({
  tab: z.enum(["seo", "themes"]).default("seo").catch("seo"),
});

export const Route = createFileRoute("/_app/p/$projectId/shopify")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "seo" })] },
  component: ShopifyRoute,
});

function ShopifyRoute() {
  const { projectId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <ShopifyPage
      projectId={projectId}
      tab={tab}
      onTabChange={(next) => {
        void navigate({ search: { tab: next }, replace: true });
      }}
    />
  );
}
