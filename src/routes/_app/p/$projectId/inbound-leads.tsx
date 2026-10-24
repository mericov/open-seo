import { createFileRoute } from "@tanstack/react-router";
import { InboundLeadsView } from "@/client/features/inbound-leads/InboundLeadsView";

export const Route = createFileRoute("/_app/p/$projectId/inbound-leads")({
  component: InboundLeadsRoute,
});

function InboundLeadsRoute() {
  const { projectId } = Route.useParams();
  return <InboundLeadsView key={projectId} projectId={projectId} />;
}
