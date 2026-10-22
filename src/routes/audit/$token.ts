import { createFileRoute } from "@tanstack/react-router";
import { LeadReportService } from "@/server/features/leads/services/LeadReportService";

export const Route = createFileRoute("/audit/$token")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        LeadReportService.render(request, params.token),
    },
  },
});
