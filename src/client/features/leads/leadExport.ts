import type { TFunction } from "i18next";
import type { LeadRow } from "@/client/features/leads/leadQueries";

const CONTACT_HEADERS = [
  "status",
  "name",
  "category",
  "email",
  "other_emails",
  "phone",
  "website",
  "instagram",
  "facebook",
  "linkedin",
  "whatsapp",
];

const LOCAL_HEADERS = ["rating", "reviews", "address", "maps"];

const STORE_HEADERS = [
  "shopify_verified",
  "products",
  "newest_product",
  "currency",
  "country",
  "domain_rank",
];

export function buildLeadExport(
  leads: LeadRow[],
  source: "local" | "shopify",
  t: TFunction<"leads">,
) {
  const headers = [
    ...CONTACT_HEADERS,
    ...(source === "shopify" ? STORE_HEADERS : LOCAL_HEADERS),
  ];
  const rows = leads.map((lead) => [
    t(`reachability.${lead.reachability}`),
    lead.name,
    lead.category,
    lead.primaryEmail,
    lead.emails
      .filter((email) => email.email !== lead.primaryEmail)
      .map((email) => email.email)
      .join(" "),
    lead.phone,
    lead.website,
    lead.instagramUrl,
    lead.facebookUrl,
    lead.linkedinUrl,
    lead.whatsappUrl,
    ...(source === "shopify"
      ? [
          lead.productCount != null ? "yes" : "no",
          lead.productCount,
          lead.lastProductAt?.slice(0, 10) ?? null,
          lead.currency,
          lead.countryCode,
          lead.domainRank,
        ]
      : [lead.rating, lead.reviewsCount, lead.address, lead.mapsUrl]),
  ]);
  return { headers, rows };
}
