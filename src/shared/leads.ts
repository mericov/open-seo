// How reachable a lead is, derived from what enrichment found. Shared by the
// app, the CSV export and the MCP tools so every surface sorts leads the same
// way.

export type LeadReachability =
  | "pending"
  | "ready"
  | "email_unreachable"
  | "social_only"
  | "no_contact";

export const LEAD_REACHABILITY_ORDER: LeadReachability[] = [
  "ready",
  "social_only",
  "email_unreachable",
  "no_contact",
  "pending",
];

export function leadReachability(lead: {
  enrichmentStatus: "pending" | "done" | "failed" | "no_website";
  primaryEmail: string | null;
  emailCount: number;
  instagramUrl: string | null;
  facebookUrl: string | null;
  whatsappUrl: string | null;
  phone: string | null;
}): LeadReachability {
  if (lead.enrichmentStatus === "pending") return "pending";
  if (lead.primaryEmail) return "ready";
  const hasSocial = Boolean(
    lead.instagramUrl || lead.facebookUrl || lead.whatsappUrl,
  );
  if (lead.emailCount > 0) return "email_unreachable";
  if (hasSocial || lead.phone) return "social_only";
  return "no_contact";
}

// Hosts many unrelated businesses list as their website (a Facebook page, a
// link-in-bio page). They say nothing about who the business is, so they never
// identify a lead or a contact.
const SHARED_HOSTS = new Set([
  "facebook.com",
  "m.facebook.com",
  "instagram.com",
  "linktr.ee",
  "linkin.bio",
  "google.com",
  "sites.google.com",
  "business.site",
  "yelp.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
  "wa.me",
  "etsy.com",
  "amazon.com",
  "calendly.com",
  "booksy.com",
  "vagaro.com",
  "houzz.com",
  "thumbtack.com",
  "nextdoor.com",
  "sahibinden.com",
  "trendyol.com",
  "hepsiburada.com",
]);

export function ownDomain(domain: string | null): string | null {
  if (!domain) return null;
  const host = domain.toLowerCase().replace(/^www\./, "");
  return SHARED_HOSTS.has(host) ? null : host;
}

// The registry key for a lead: its business domain, or the address itself
// when the business has no domain of its own.
export function contactKeyFor(lead: {
  domain: string | null;
  primaryEmail: string | null;
}): string | null {
  return ownDomain(lead.domain) ?? lead.primaryEmail?.toLowerCase() ?? null;
}
