import { createFileRoute } from "@tanstack/react-router";
import { LeadReportService } from "@/server/features/leads/services/LeadReportService";

export const Route = createFileRoute("/lr/$token")({
  server: {
    handlers: {
      GET: ({ params }) => LeadReportService.render(params.token),
    },
  },
});
