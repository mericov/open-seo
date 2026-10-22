import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/p/$projectId/digital-pr/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/p/$projectId/digital-pr/gap",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});
