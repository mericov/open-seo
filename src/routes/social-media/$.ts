import { createFileRoute } from "@tanstack/react-router";
import { SocialMediaService } from "@/server/features/social/services/SocialMediaService";

export const Route = createFileRoute("/social-media/$")({
  server: {
    handlers: {
      GET: ({ params }) => SocialMediaService.serve(params._splat ?? ""),
    },
  },
});
