import { createFileRoute } from "@tanstack/react-router";
import { OutreachView } from "@/client/features/digital-pr/OutreachView";

export const Route = createFileRoute("/_app/p/$projectId/digital-pr/outreach")({
  component: OutreachRoute,
});

function OutreachRoute() {
  const { projectId } = Route.useParams();
  return <OutreachView key={projectId} projectId={projectId} />;
}
