import { createFileRoute } from "@tanstack/react-router";
import { InboundLeadService } from "@/server/features/inbound-leads/services/InboundLeadService";

// Public, secret-gated intake for leads submitted on the project's own website.
// The site's form handler filters spam first and posts JSON here with
// `Authorization: Bearer <INBOUND_LEADS_SECRET>`; Cloudflare Access bypasses
// this path so the site can reach it without a login.
export const Route = createFileRoute("/api/inbound-leads")({
  server: {
    handlers: {
      POST: ({ request }) => InboundLeadService.handleIngest(request),
    },
  },
});
