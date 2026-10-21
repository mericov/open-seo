import type { TFunction } from "i18next";
import type {
  LeadRow,
  ProjectLeadFilters,
} from "@/client/features/leads/leadQueries";
import { exportRows, type ExportFormat } from "@/client/lib/exportRows";
import { listProjectLeads } from "@/serverFunctions/leads";
import { LEAD_LIST_MAX_PAGE_SIZE } from "@/types/schemas/leads";

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

export async function exportAllLeads(
  projectId: string,
  filters: ProjectLeadFilters,
  format: ExportFormat,
  t: TFunction<"leads">,
) {
  const all = await listProjectLeads({
    data: {
      projectId,
      ...filters,
      page: 1,
      pageSize: LEAD_LIST_MAX_PAGE_SIZE,
    },
  });
  await exportRows({
    format,
    feature: "lead_finder",
    headers: [
      "name",
      "first_line",
      "note",
      "reminder",
      "score",
      "gaps",
      "email",
      "phone",
      "website",
      "instagram",
      "facebook",
      "linkedin",
      "whatsapp",
      "status",
      "emailed_at",
      "search",
      "country",
      "products",
      "rating",
      "reviews",
    ],
    rows: all.leads.map((lead) => [
      lead.name,
      lead.firstLine,
      lead.noteText,
      lead.remindAt,
      lead.opportunityScore,
      lead.findings
        .map((code) => {
          const detail = lead.findingDetails[code];
          return `${t(`findings.${code}`)}${detail ? ` (${detail})` : ""}`;
        })
        .join(", "),
      lead.primaryEmail,
      lead.phone,
      lead.website,
      lead.instagramUrl,
      lead.facebookUrl,
      lead.linkedinUrl,
      lead.whatsappUrl,
      t(`outreach.${lead.outreachStatus}`),
      lead.contactedAt?.slice(0, 10) ?? null,
      lead.searchLabel,
      lead.countryCode,
      lead.productCount,
      lead.rating,
      lead.reviewsCount,
    ]),
    filename: "leads-all",
  });
}
