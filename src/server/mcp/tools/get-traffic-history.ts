import { reverse } from "remeda";
import { z } from "zod";
import {
  TrafficHistoryService,
  type TrafficHistoryView,
} from "@/server/features/traffic-history/services/TrafficHistoryService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { locationCodeSchema, projectIdSchema } from "@/server/mcp/schemas";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";
import { TRAFFIC_POSITION_GROUPS } from "@/shared/trafficHistory";

const inputSchema = {
  projectId: projectIdSchema,
  domain: z
    .string()
    .min(1)
    .max(2048)
    .describe("Domain to read (e.g. 'example.com')."),
  locationCode: locationCodeSchema.optional(),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;
type MonthRow = TrafficHistoryView["months"][number];

function groupTotal(
  positions: MonthRow["organicPositions"],
  bands: readonly (keyof MonthRow["organicPositions"])[],
) {
  return bands.reduce((sum, band) => sum + (positions[band] ?? 0), 0);
}

const MONTH_COLUMNS: McpTableColumn<MonthRow>[] = [
  { header: "month", value: (row) => row.month },
  {
    header: "organic_traffic",
    value: (row) => row.organicTraffic && Math.round(row.organicTraffic),
  },
  {
    header: "paid_traffic",
    value: (row) => row.paidTraffic && Math.round(row.paidTraffic),
  },
  { header: "organic_keywords", value: (row) => row.organicKeywords },
  { header: "paid_keywords", value: (row) => row.paidKeywords },
  ...TRAFFIC_POSITION_GROUPS.map((group) => ({
    header: `organic_${group.key}`,
    value: (row: MonthRow) => groupTotal(row.organicPositions, group.bands),
  })),
];

export const getTrafficHistoryTool = {
  name: "get_traffic_history",
  config: {
    title: "Get traffic history",
    description:
      "Reads the stored monthly organic and paid (Google Ads) traffic history of a domain for one country: estimated traffic, keyword counts and organic keywords per position group, plus the stored country split, backlink summary and month notes. Only returns data already saved from Domain Overview; it never calls DataForSEO and uses no credits. If nothing is stored, ask the user to open the domain in Domain Overview.",
    inputSchema,
    outputSchema: z.looseObject({
      domain: z.string(),
      locationCode: z.number(),
      months: z.array(looseObjectOutputSchema),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args: Args, context) => {
    const market = TrafficHistoryService.resolveMarket({
      organizationId: context.auth.organizationId,
      project: context.project,
      domain: args.domain,
      locationCode: args.locationCode,
    });
    const view = await TrafficHistoryService.getView(market);
    const header = view.fetch
      ? `${view.domain}, location ${view.locationCode}/${view.languageCode}: ${view.months.length} stored months (covered from ${view.fetch.coveredFrom}, last fetched ${view.fetch.lastFetchedAt}). Traffic values are estimates.`
      : `No traffic history is stored for ${view.domain} in location ${view.locationCode}. Open the domain in Domain Overview to load it.`;
    const backlinks = view.backlinks
      ? `Backlinks: ${view.backlinks.backlinks ?? "?"}, referring domains: ${view.backlinks.referringDomains ?? "?"}, domain rank: ${view.backlinks.domainRank ?? "?"} (fetched ${view.backlinks.fetchedAt}).`
      : null;
    const topCountries = view.countries
      .slice(0, 10)
      .map(
        (country) =>
          `${country.locationCode}: ${Math.round(country.organicTraffic)} organic traffic, ${country.organicKeywords} keywords`,
      )
      .join("; ");
    const text = [
      header,
      view.months.length > 0
        ? formatMcpTable(reverse(view.months), MONTH_COLUMNS)
        : null,
      backlinks,
      topCountries ? `Top countries (location code): ${topCountries}` : null,
      view.notes.length > 0
        ? `Notes: ${view.notes.map((note) => `${note.month} ${note.body}`).join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/domain`,
        {
          domain: view.domain,
        },
      ),
      structuredContent: view,
    });
  }),
};
