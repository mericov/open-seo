import { z } from "zod";
import { LeadOutreachService } from "@/server/features/leads/services/LeadOutreachService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";
import { LEAD_OUTREACH_STATUSES } from "@/shared/leadFindings";
import { LEAD_STATUS_MAX_IDS } from "@/types/schemas/leads";

const allLeadsPath = (projectId: string) => `/p/${projectId}/leads?view=all`;

const statusSchema = z
  .enum(LEAD_OUTREACH_STATUSES)
  .describe(
    "Outreach status: new, contacted (email sent), replied, not_interested, client.",
  );

// ---------------------------------------------------------------------------
// list_leads
// ---------------------------------------------------------------------------

const listLeadsInputSchema = {
  projectId: projectIdSchema,
  status: statusSchema.optional(),
  source: z
    .enum(["local", "shopify"])
    .optional()
    .describe("Only local business leads or only online store leads."),
  hasEmail: z
    .boolean()
    .optional()
    .describe("Only leads with a reachable email."),
  minScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "Only leads whose opportunity score (0-100, higher means more visible marketing gaps) is at least this.",
    ),
  page: z.number().int().min(1).optional().describe("Page number, from 1."),
} as const;

type ListedLead = Awaited<
  ReturnType<typeof LeadOutreachService.listLeads>
>["leads"][number];

const COLUMNS: McpTableColumn<ListedLead>[] = [
  { header: "id", value: (row) => row.id },
  { header: "name", value: (row) => row.name },
  { header: "score", value: (row) => row.opportunityScore },
  { header: "gaps", value: (row) => row.findings.join(" ") },
  { header: "email", value: (row) => row.primaryEmail },
  { header: "website", value: (row) => row.website },
  { header: "status", value: (row) => row.outreachStatus },
];

export const listLeadsTool = {
  name: "list_leads",
  config: {
    title: "List leads",
    description:
      "Reads the project's combined lead list across every lead search, highest opportunity score first, 50 per page. Each lead shows its marketing gaps (no analytics, no Meta pixel, no schema, no blog, no website and so on) and outreach status. Uses no credits.",
    inputSchema: listLeadsInputSchema,
    outputSchema: z.looseObject({
      leads: z.array(looseObjectOutputSchema),
      total: z.number(),
      counts: looseObjectOutputSchema,
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (
      args: z.infer<z.ZodObject<typeof listLeadsInputSchema>>,
      context,
    ) => {
      const result = await LeadOutreachService.listLeads(
        args.projectId,
        {
          status: args.status,
          source: args.source,
          hasEmail: args.hasEmail,
          minScore: args.minScore,
        },
        { page: args.page ?? 1, pageSize: 50 },
      );
      const header = `${result.total} leads match (page ${result.page}). All statuses: ${result.counts.new} new, ${result.counts.contacted} contacted, ${result.counts.replied} replied, ${result.counts.not_interested} not interested, ${result.counts.client} clients.`;
      return mcpResponse({
        text:
          result.leads.length === 0
            ? header
            : `${header}\n${formatMcpTable(result.leads, COLUMNS)}`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          allLeadsPath(args.projectId),
        ),
        structuredContent: result,
      });
    },
  ),
};

// ---------------------------------------------------------------------------
// update_leads
// ---------------------------------------------------------------------------

const updateLeadsInputSchema = {
  projectId: projectIdSchema,
  leadIds: z
    .array(z.string().min(1))
    .min(1)
    .max(LEAD_STATUS_MAX_IDS)
    .describe("Lead ids from list_leads or get_leads."),
  status: statusSchema,
} as const;

export const updateLeadsTool = {
  name: "update_leads",
  config: {
    title: "Update leads",
    description:
      "Sets the outreach status of leads, for example marking them contacted after an email goes out. Leads marked not_interested or client stay in the list so later searches never add them again. Uses no credits.",
    inputSchema: updateLeadsInputSchema,
    outputSchema: z.looseObject({
      updated: z.number(),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (
      args: z.infer<z.ZodObject<typeof updateLeadsInputSchema>>,
      context,
    ) => {
      const result = await LeadOutreachService.setStatus(
        args.projectId,
        args.leadIds,
        args.status,
      );
      return mcpResponse({
        text: `Marked ${result.updated} leads as ${args.status}.`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          allLeadsPath(args.projectId),
        ),
        structuredContent: result,
      });
    },
  ),
};
