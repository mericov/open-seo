import { z } from "zod";
import {
  LEAD_ENRICH_BATCH_SIZE,
  LeadFinderService,
} from "@/server/features/leads/services/LeadFinderService";
import {
  STORE_IMPORT_MAX_DOMAINS,
  StoreFinderService,
} from "@/server/features/leads/services/StoreFinderService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";
import { LEAD_SEARCH_MAX_LIMIT } from "@/types/schemas/leads";

const leadsPath = (projectId: string, searchId?: string) =>
  searchId
    ? `/p/${projectId}/leads?search=${searchId}`
    : `/p/${projectId}/leads`;

// ---------------------------------------------------------------------------
// find_leads
// ---------------------------------------------------------------------------

const findLeadsInputSchema = {
  projectId: projectIdSchema,
  category: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .describe(
      "Google Business category slug, e.g. 'home_staging_service' or 'florist'. Find valid slugs with list_business_categories.",
    ),
  location: z
    .string()
    .min(2)
    .max(200)
    .describe(
      "Place to search around, e.g. 'Austin, TX' or 'Kadıköy, İstanbul'.",
    ),
  radiusKm: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Search radius in kilometers (1-100). Defaults to 25."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LEAD_SEARCH_MAX_LIMIT)
    .optional()
    .describe(
      `Maximum businesses to pull (1-${LEAD_SEARCH_MAX_LIMIT}). Defaults to 30.`,
    ),
  nameQuery: z
    .string()
    .max(120)
    .optional()
    .describe("Optional text the business name must contain."),
  minRating: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .describe("Only businesses rated at least this (1-5)."),
} as const;

export const findLeadsTool = {
  name: "find_leads",
  config: {
    title: "Find leads",
    description:
      "Starts a lead list: pulls local businesses in one Google Business category around a place and saves them to the project's Lead Finder, skipping businesses already found in earlier searches. Contact details are not read yet; call enrich_leads with the returned searchId until remaining is 0. Charges credits for the business listings lookup.",
    inputSchema: findLeadsInputSchema,
    outputSchema: z.looseObject({
      searchId: z.string(),
      found: z.number(),
      added: z.number(),
      skippedDuplicates: z.number(),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (
      args: z.infer<z.ZodObject<typeof findLeadsInputSchema>>,
      context,
    ) => {
      const result = await LeadFinderService.startSearch(
        {
          projectId: args.projectId,
          category: args.category,
          location: args.location,
          radiusKm: args.radiusKm ?? 25,
          limit: args.limit ?? 30,
          nameQuery: args.nameQuery,
          minRating: args.minRating,
        },
        context.billing,
      );
      return mcpResponse({
        text: `Found ${result.found} businesses; added ${result.added} new leads (${result.skippedDuplicates} already in earlier searches). Next: call enrich_leads with searchId ${result.searchId}.`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          leadsPath(args.projectId, result.searchId),
        ),
        structuredContent: result,
      });
    },
  ),
};

// ---------------------------------------------------------------------------
// find_shopify_stores
// ---------------------------------------------------------------------------

const findStoresInputSchema = {
  projectId: projectIdSchema,
  keywords: z
    .array(z.string().min(1).max(60))
    .max(10)
    .optional()
    .describe(
      "Niche words matched against store titles and descriptions, e.g. ['candle'] or ['çiçek', 'flower']. Ignored when domains is set.",
    ),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe("Two-letter country code of the stores, e.g. 'TR' or 'US'."),
  maxRank: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .describe(
      "Only stores whose backlink rank (0-1000) is at most this; lower ranks are smaller stores.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LEAD_SEARCH_MAX_LIMIT)
    .optional()
    .describe(
      `Maximum stores to pull (1-${LEAD_SEARCH_MAX_LIMIT}). Defaults to 30.`,
    ),
  domains: z
    .array(z.string().min(3).max(253))
    .max(STORE_IMPORT_MAX_DOMAINS)
    .optional()
    .describe(
      "Store domains you already have. When set, no lookup runs and no credits are used; the stores are saved for enrich_leads.",
    ),
} as const;

export const findShopifyStoresTool = {
  name: "find_shopify_stores",
  config: {
    title: "Find Shopify stores",
    description:
      "Starts a lead list of Shopify stores, either found by niche keywords, country and size, or from domains you pass. Stores already found in earlier searches are skipped. Then call enrich_leads with the returned searchId until remaining is 0: it reads each store for emails and social links, confirms it runs on Shopify, and records its product count and newest product date. A keyword lookup charges credits; passing domains is free.",
    inputSchema: findStoresInputSchema,
    outputSchema: z.looseObject({
      searchId: z.string(),
      found: z.number(),
      added: z.number(),
      skippedDuplicates: z.number(),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (
      args: z.infer<z.ZodObject<typeof findStoresInputSchema>>,
      context,
    ) => {
      const result = args.domains?.length
        ? await StoreFinderService.importStores(
            args.projectId,
            args.domains.join("\n"),
          )
        : await StoreFinderService.startStoreSearch(
            {
              projectId: args.projectId,
              keywords: args.keywords ?? [],
              countryCode: args.countryCode,
              maxRank: args.maxRank,
              limit: args.limit ?? 30,
            },
            context.billing,
          );
      return mcpResponse({
        text: `Found ${result.found} stores; added ${result.added} new leads (${result.skippedDuplicates} already in earlier searches). Next: call enrich_leads with searchId ${result.searchId}.`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          leadsPath(args.projectId, result.searchId),
        ),
        structuredContent: result,
      });
    },
  ),
};

// ---------------------------------------------------------------------------
// enrich_leads
// ---------------------------------------------------------------------------

const searchInputSchema = {
  projectId: projectIdSchema,
  searchId: z
    .string()
    .min(1)
    .describe("Lead search id from find_leads or get_leads."),
} as const;

export const enrichLeadsTool = {
  name: "enrich_leads",
  config: {
    title: "Enrich leads",
    description: `Reads the next ${LEAD_ENRICH_BATCH_SIZE} pending leads' websites for emails, social profiles and WhatsApp links, and checks each email's domain can receive mail. Call it repeatedly until remaining is 0, then read the list with get_leads. Uses no credits.`,
    inputSchema: searchInputSchema,
    outputSchema: z.looseObject({
      processed: z.number(),
      remaining: z.number(),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof searchInputSchema>>, context) => {
      const result = await LeadFinderService.enrichNextBatch(
        args.projectId,
        args.searchId,
      );
      return mcpResponse({
        text:
          result.remaining > 0
            ? `Read ${result.processed} websites; ${result.remaining} leads still pending. Call enrich_leads again.`
            : `Read ${result.processed} websites; all leads are enriched. Call get_leads to see them.`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          leadsPath(args.projectId, args.searchId),
        ),
        structuredContent: result,
      });
    },
  ),
};

// ---------------------------------------------------------------------------
// get_leads
// ---------------------------------------------------------------------------

const getLeadsInputSchema = {
  projectId: projectIdSchema,
  searchId: z
    .string()
    .min(1)
    .optional()
    .describe("Lead search to read. Omit to list the project's lead searches."),
} as const;

type LeadRow = Awaited<
  ReturnType<typeof LeadFinderService.getSearchDetail>
>["leads"][number];

const LEAD_COLUMNS: McpTableColumn<LeadRow>[] = [
  { header: "status", value: (row) => row.reachability },
  { header: "name", value: (row) => row.name },
  { header: "email", value: (row) => row.primaryEmail },
  { header: "phone", value: (row) => row.phone },
  { header: "website", value: (row) => row.website },
  { header: "instagram", value: (row) => row.instagramUrl },
  { header: "whatsapp", value: (row) => row.whatsappUrl },
  { header: "rating", value: (row) => row.rating },
  { header: "reviews", value: (row) => row.reviewsCount },
];

const STORE_COLUMNS: McpTableColumn<LeadRow>[] = [
  { header: "status", value: (row) => row.reachability },
  { header: "store", value: (row) => row.name },
  { header: "email", value: (row) => row.primaryEmail },
  { header: "website", value: (row) => row.website },
  {
    header: "shopify",
    value: (row) => (row.productCount != null ? "yes" : "unverified"),
  },
  { header: "products", value: (row) => row.productCount },
  {
    header: "newest_product",
    value: (row) => row.lastProductAt?.slice(0, 10) ?? null,
  },
  { header: "country", value: (row) => row.countryCode },
  { header: "instagram", value: (row) => row.instagramUrl },
];

export const getLeadsTool = {
  name: "get_leads",
  config: {
    title: "Get leads",
    description:
      "Reads a saved lead list with each business's best email, phone, website and social links, sorted with ready-to-email leads first. Without searchId it lists the project's lead searches with their progress. Uses no credits.",
    inputSchema: getLeadsInputSchema,
    outputSchema: z.looseObject({
      searches: z.array(looseObjectOutputSchema).optional(),
      search: looseObjectOutputSchema.optional(),
      summary: looseObjectOutputSchema.optional(),
      leads: z.array(looseObjectOutputSchema).optional(),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof getLeadsInputSchema>>, context) => {
      if (!args.searchId) {
        const searches = await LeadFinderService.listSearches(args.projectId);
        const text =
          searches.length === 0
            ? "No lead searches yet. Start one with find_leads."
            : searches
                .map(
                  (search) =>
                    `- ${search.label} (${search.id}): ${search.total} leads, ${search.ready} ready to email, ${search.pending} pending`,
                )
                .join("\n");
        return mcpResponse({
          text,
          meta: buildProjectMeta(
            context,
            args.projectId,
            leadsPath(args.projectId),
          ),
          structuredContent: { searches },
        });
      }

      const detail = await LeadFinderService.getSearchDetail(
        args.projectId,
        args.searchId,
      );
      const { summary } = detail;
      const header = `${detail.search.label}: ${detail.leads.length} leads — ${summary.ready} ready to email, ${summary.social_only} reachable by phone or social only, ${summary.email_unreachable} with dead email domains, ${summary.no_contact} with no contact, ${summary.pending} pending.`;
      return mcpResponse({
        text:
          detail.leads.length === 0
            ? header
            : `${header}\n${formatMcpTable(
                detail.leads,
                detail.search.source === "shopify"
                  ? STORE_COLUMNS
                  : LEAD_COLUMNS,
              )}`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          leadsPath(args.projectId, args.searchId),
        ),
        structuredContent: detail,
      });
    },
  ),
};
