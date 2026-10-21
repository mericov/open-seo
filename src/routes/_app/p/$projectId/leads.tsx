import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LeadFinderPage } from "@/client/features/leads/LeadFinderPage";
import { LeadSearchDetail } from "@/client/features/leads/LeadSearchDetail";

const searchSchema = z.object({
  search: z.string().min(1).optional().catch(undefined),
  view: z.enum(["searches", "all"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/p/$projectId/leads")({
  validateSearch: searchSchema,
  component: LeadsRoute,
});

function LeadsRoute() {
  const { projectId } = Route.useParams();
  const { search, view } = Route.useSearch();
  return search ? (
    <LeadSearchDetail key={search} projectId={projectId} searchId={search} />
  ) : (
    <LeadFinderPage projectId={projectId} view={view ?? "searches"} />
  );
}
