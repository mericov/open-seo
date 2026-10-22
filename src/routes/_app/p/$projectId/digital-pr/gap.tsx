import { createFileRoute } from "@tanstack/react-router";
import { CompetitorGapView } from "@/client/features/digital-pr/CompetitorGapView";

export const Route = createFileRoute("/_app/p/$projectId/digital-pr/gap")({
  component: GapRoute,
});

function GapRoute() {
  const { projectId } = Route.useParams();
  return <CompetitorGapView key={projectId} projectId={projectId} />;
}
