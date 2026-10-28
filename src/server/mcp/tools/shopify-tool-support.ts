import { z } from "zod";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { projectIdSchema } from "@/server/mcp/schemas";

export const shopifyPath = (projectId: string) => `/p/${projectId}/shopify`;

export const resultOutputSchema = z
  .object({ result: z.unknown(), ...optionalMetaOutputSchema })
  .passthrough();

export function respond(
  context: { baseUrl: string },
  projectId: string,
  summary: string,
  result: unknown,
) {
  return mcpResponse({
    text: `${summary}\n\n${JSON.stringify(result, null, 2)}`,
    meta: buildProjectMeta(context, projectId, shopifyPath(projectId)),
    structuredContent: { result },
  });
}

export const readOnly = {
  readOnlyHint: true,
  openWorldHint: true,
  destructiveHint: false,
} as const;

export const writes = {
  readOnlyHint: false,
  openWorldHint: true,
  destructiveHint: false,
} as const;

export const projectInput = { projectId: projectIdSchema } as const;
