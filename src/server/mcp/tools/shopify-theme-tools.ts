import { z } from "zod";
import { ShopifyThemeService } from "@/server/features/shopify/services/ShopifyThemeService";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import {
  projectInput,
  readOnly,
  respond,
  resultOutputSchema,
  writes,
} from "@/server/mcp/tools/shopify-tool-support";

export const listShopifyThemesTool = {
  name: "list_shopify_themes",
  config: {
    title: "List Shopify themes",
    description:
      'List the store\'s themes with role (MAIN is live), preview and editor links. MericSEO copies are named "MericSEO vN · summary". Uses no credits.',
    inputSchema: projectInput,
    outputSchema: resultOutputSchema,
    annotations: readOnly,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof projectInput>>, context) => {
      const result = await ShopifyThemeService.listThemes(args.projectId);
      return respond(
        context,
        args.projectId,
        `${result.length} theme(s).`,
        result,
      );
    },
  ),
};

const copyInput = {
  projectId: projectIdSchema,
  summary: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe("Short summary of the planned change, shown in the theme name"),
  sourceThemeId: z
    .string()
    .optional()
    .describe("Theme to copy. Defaults to the live theme."),
} as const;

export const createShopifyThemeCopyTool = {
  name: "create_shopify_theme_copy",
  config: {
    title: "Create a working copy of a Shopify theme",
    description:
      'Duplicate the live theme (or sourceThemeId) into an unpublished copy named "MericSEO vN · summary" with the next version number. Always make code changes (Liquid, CSS, JS, JSON templates) in a copy, never in the live theme. Uses no credits.',
    inputSchema: copyInput,
    outputSchema: resultOutputSchema,
    annotations: writes,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof copyInput>>, context) => {
      const result = await ShopifyThemeService.createCopy(
        args.projectId,
        args.summary,
        args.sourceThemeId,
      );
      return respond(
        context,
        args.projectId,
        `Created "${result.name}". Shopify may take a minute to finish copying (processing: ${result.processing}). Preview: ${result.previewUrl}`,
        result,
      );
    },
  ),
};

const readFilesInput = {
  projectId: projectIdSchema,
  themeId: z.string().min(1),
  filenames: z
    .array(z.string().min(1).max(300))
    .max(50)
    .optional()
    .describe(
      "Files to read, e.g. sections/header.liquid, assets/base.css. Wildcards like sections/*.liquid work. Omit to list every file name.",
    ),
} as const;

export const readShopifyThemeFilesTool = {
  name: "read_shopify_theme_files",
  config: {
    title: "Read Shopify theme files",
    description:
      "List a theme's files, or read the content of specific files. Uses no credits.",
    inputSchema: readFilesInput,
    outputSchema: resultOutputSchema,
    annotations: readOnly,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof readFilesInput>>, context) => {
      const result = args.filenames?.length
        ? await ShopifyThemeService.readFiles(
            args.projectId,
            args.themeId,
            args.filenames,
          )
        : await ShopifyThemeService.listFiles(args.projectId, args.themeId);
      return respond(
        context,
        args.projectId,
        `${result.length} file(s).`,
        result,
      );
    },
  ),
};

const writeFilesInput = {
  projectId: projectIdSchema,
  themeId: z
    .string()
    .min(1)
    .describe("A MericSEO theme copy, never the live theme"),
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(300),
        content: z.string().max(1_000_000),
      }),
    )
    .max(20)
    .default([]),
  deleteFilenames: z.array(z.string().min(1).max(300)).max(20).optional(),
  summary: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("Updated work summary for the copy's name"),
} as const;

export const writeShopifyThemeFilesTool = {
  name: "write_shopify_theme_files",
  config: {
    title: "Write Shopify theme files",
    description:
      "Create or overwrite whole files (and optionally delete files) in an unpublished theme copy. Refuses the live theme. Read a file first and send its full new content. Pass summary to update the copy's name with what was changed. Uses no credits.",
    inputSchema: writeFilesInput,
    outputSchema: resultOutputSchema,
    annotations: writes,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof writeFilesInput>>, context) => {
      const written =
        args.files.length > 0
          ? await ShopifyThemeService.writeFiles(
              args.projectId,
              args.themeId,
              args.files,
            )
          : null;
      const deleted = args.deleteFilenames?.length
        ? await ShopifyThemeService.deleteFiles(
            args.projectId,
            args.themeId,
            args.deleteFilenames,
          )
        : null;
      const renamed = args.summary
        ? await ShopifyThemeService.renameCopy(
            args.projectId,
            args.themeId,
            args.summary,
          )
        : null;
      return respond(context, args.projectId, "Theme updated.", {
        written,
        deleted,
        renamed,
      });
    },
  ),
};

const publishThemeInput = {
  projectId: projectIdSchema,
  themeId: z.string().min(1),
} as const;

export const publishShopifyThemeTool = {
  name: "publish_shopify_theme",
  config: {
    title: "Publish a Shopify theme",
    description:
      "Make a theme copy the live theme. Only call this after the user has previewed the copy and explicitly asked to publish it. The previous live theme stays in the theme library, so it can be published back. Uses no credits.",
    inputSchema: publishThemeInput,
    outputSchema: resultOutputSchema,
    annotations: { ...writes, destructiveHint: true },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof publishThemeInput>>, context) => {
      const result = await ShopifyThemeService.publishTheme(
        args.projectId,
        args.themeId,
      );
      return respond(
        context,
        args.projectId,
        `"${result.name}" is now live.`,
        result,
      );
    },
  ),
};
