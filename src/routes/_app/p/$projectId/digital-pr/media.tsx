import { createFileRoute } from "@tanstack/react-router";
import { MediaDatabaseView } from "@/client/features/digital-pr/MediaDatabaseView";

export const Route = createFileRoute("/_app/p/$projectId/digital-pr/media")({
  component: MediaRoute,
});

function MediaRoute() {
  const { projectId } = Route.useParams();
  return <MediaDatabaseView key={projectId} projectId={projectId} />;
}
