import { z } from "zod";
import { InboundLeadService } from "@/server/features/inbound-leads/services/InboundLeadService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { formatMcpTable, type McpTableColumn } from "@/server/mcp/table";
import {
  INBOUND_LEAD_STATUSES,
  INBOUND_LEAD_VERDICTS,
} from "@/shared/inboundLeads";

const sitePath = (projectId: string) => `/p/${projectId}/inbound-leads`;

const statusSchema = z
  .enum(INBOUND_LEAD_STATUSES)
  .describe("Follow-up status: new, contacted, client, lost.");
const verdictSchema = z
  .enum(INBOUND_LEAD_VERDICTS)
  .describe(
    "Spam check result: ok (real request), suspicious (likely real but flagged), spam.",
  );

const listInputSchema = {
  projectId: projectIdSchema,
  verdict: verdictSchema
    .optional()
    .describe("Defaults to ok. Pass suspicious or spam to review those."),
  status: statusSchema.optional(),
  page: z.number().int().min(1).optional().describe("Page number, from 1."),
} as const;

type ListedInboundLead = Awaited<
  ReturnType<typeof InboundLeadService.list>
>["leads"][number];

const COLUMNS: McpTableColumn<ListedInboundLead>[] = [
  { header: "id", value: (row) => row.id },
  { header: "received", value: (row) => row.createdAt },
  { header: "name", value: (row) => row.name },
  { header: "email", value: (row) => row.email },
  { header: "phone", value: (row) => row.phone },
  { header: "website", value: (row) => row.website },
  { header: "message", value: (row) => row.message },
  { header: "source", value: (row) => row.source },
  { header: "status", value: (row) => row.status },
  { header: "reason", value: (row) => row.reason },
  { header: "note", value: (row) => row.note },
];

export const listInboundLeadsTool = {
  name: "list_inbound_leads",
  config: {
    title: "List site leads",
    description:
      "Reads requests submitted through the forms on the project's own website (free audit, contact and city page forms), newest first, 50 per page. These are inbound leads, kept separate from Lead Finder's prospect lists. Uses no credits.",
    inputSchema: listInputSchema,
    outputSchema: z.looseObject({
      leads: z.array(looseObjectOutputSchema),
      total: z.number(),
      counts: looseObjectOutputSchema,
      newCount: z.number(),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof listInputSchema>>, context) => {
      const verdict = args.verdict ?? "ok";
      const result = await InboundLeadService.list(
        args.projectId,
        { verdict, status: args.status },
        { page: args.page ?? 1, pageSize: 50 },
      );
      const header = `${result.total} ${verdict} site leads match (page ${result.page}). ${result.newCount} real or suspicious leads still marked new. Totals: ${result.counts.ok} ok, ${result.counts.suspicious} suspicious, ${result.counts.spam} spam.`;
      return mcpResponse({
        text:
          result.leads.length === 0
            ? header
            : `${header}\n${formatMcpTable(result.leads, COLUMNS)}`,
        meta: buildProjectMeta(context, args.projectId, sitePath(args.projectId)),
        structuredContent: result,
      });
    },
  ),
};

const updateInputSchema = {
  projectId: projectIdSchema,
  leadIds: z
    .array(z.string().min(1))
    .min(1)
    .max(200)
    .describe("Site lead ids from list_inbound_leads."),
  status: statusSchema.optional(),
  verdict: verdictSchema.optional(),
} as const;

export const updateInboundLeadsTool = {
  name: "update_inbound_leads",
  config: {
    title: "Update site leads",
    description:
      "Sets the follow-up status of site leads (for example contacted after replying) or corrects the spam check (mark spam, or ok for a real request). Uses no credits.",
    inputSchema: updateInputSchema,
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
    async (args: z.infer<z.ZodObject<typeof updateInputSchema>>, context) => {
      const result = await InboundLeadService.update(
        args.projectId,
        args.leadIds,
        { status: args.status, verdict: args.verdict },
      );
      return mcpResponse({
        text: `Updated ${result.updated} site leads.`,
        meta: buildProjectMeta(context, args.projectId, sitePath(args.projectId)),
        structuredContent: result,
      });
    },
  ),
};
