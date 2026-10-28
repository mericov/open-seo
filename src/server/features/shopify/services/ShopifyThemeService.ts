import { AppError } from "@/server/lib/errors";
import {
  requireShopifyConnection,
  shopifyGraphql,
  throwOnUserErrors,
} from "@/server/features/shopify/services/shopifyClient";
import {
  numericShopifyId,
  shopHandle,
  themeCopyName,
  themeCopyVersion,
} from "@/shared/shopify";

type UserError = { field?: string[] | null; message: string };

type ThemeNode = {
  id: string;
  name: string;
  role: string;
  processing: boolean;
  createdAt: string;
  updatedAt: string;
};

const THEME_FIELDS = "id name role processing createdAt updatedAt";

function toThemeGid(themeId: string) {
  return themeId.startsWith("gid://")
    ? themeId
    : `gid://shopify/OnlineStoreTheme/${themeId}`;
}

function withLinks(theme: ThemeNode, shopDomain: string) {
  const numericId = numericShopifyId(theme.id);
  return {
    ...theme,
    isMericSeoCopy: themeCopyVersion(theme.name) !== null,
    version: themeCopyVersion(theme.name),
    previewUrl: `https://${shopDomain}/?preview_theme_id=${numericId}`,
    editorUrl: `https://admin.shopify.com/store/${shopHandle(shopDomain)}/themes/${numericId}/editor`,
  };
}

async function listThemes(projectId: string) {
  const connection = await requireShopifyConnection(projectId);
  const data = await shopifyGraphql<{ themes: { nodes: ThemeNode[] } }>(
    projectId,
    `query MericSeoThemes { themes(first: 100) { nodes { ${THEME_FIELDS} } } }`,
  );
  return data.themes.nodes.map((theme) =>
    withLinks(theme, connection.shopDomain),
  );
}

async function getTheme(projectId: string, themeId: string) {
  const data = await shopifyGraphql<{ theme: ThemeNode | null }>(
    projectId,
    `query MericSeoTheme($id: ID!) { theme(id: $id) { ${THEME_FIELDS} } }`,
    { id: toThemeGid(themeId) },
  );
  if (!data.theme) throw new AppError("NOT_FOUND", "Theme not found.");
  return data.theme;
}

async function createCopy(
  projectId: string,
  summary: string,
  sourceThemeId?: string,
) {
  const connection = await requireShopifyConnection(projectId);
  const themes = await listThemes(projectId);
  const source = sourceThemeId
    ? themes.find((theme) => theme.id === toThemeGid(sourceThemeId))
    : themes.find((theme) => theme.role === "MAIN");
  if (!source) throw new AppError("NOT_FOUND", "Source theme not found.");
  const nextVersion =
    Math.max(0, ...themes.map((theme) => theme.version ?? 0)) + 1;
  const name = themeCopyName(nextVersion, summary);
  const data = await shopifyGraphql<{
    themeDuplicate: {
      newTheme: ThemeNode | null;
      userErrors: UserError[];
    } | null;
  }>(
    projectId,
    `mutation MericSeoThemeDuplicate($id: ID!, $name: String) {
      themeDuplicate(id: $id, name: $name) {
        newTheme { ${THEME_FIELDS} }
        userErrors { field message }
      }
    }`,
    { id: source.id, name },
  );
  throwOnUserErrors(data.themeDuplicate?.userErrors, "Theme copy");
  const theme = data.themeDuplicate?.newTheme;
  if (!theme)
    throw new AppError(
      "VALIDATION_ERROR",
      "Shopify did not return the new theme.",
    );
  return {
    ...withLinks(theme, connection.shopDomain),
    sourceThemeId: source.id,
    sourceThemeName: source.name,
  };
}

async function renameCopy(projectId: string, themeId: string, summary: string) {
  const theme = await requireWritableTheme(projectId, themeId);
  const version = themeCopyVersion(theme.name);
  if (version === null) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Only MericSEO theme copies can be renamed here.",
    );
  }
  const data = await shopifyGraphql<{
    themeUpdate: { theme: ThemeNode | null; userErrors: UserError[] } | null;
  }>(
    projectId,
    `mutation MericSeoThemeRename($id: ID!, $input: OnlineStoreThemeInput!) {
      themeUpdate(id: $id, input: $input) {
        theme { ${THEME_FIELDS} }
        userErrors { field message }
      }
    }`,
    { id: theme.id, input: { name: themeCopyName(version, summary) } },
  );
  throwOnUserErrors(data.themeUpdate?.userErrors, "Theme rename");
  return data.themeUpdate?.theme ?? theme;
}

async function requireWritableTheme(projectId: string, themeId: string) {
  const theme = await getTheme(projectId, themeId);
  if (theme.role === "MAIN") {
    throw new AppError(
      "VALIDATION_ERROR",
      "This is the live theme. MericSEO only edits theme copies: create one with create_shopify_theme_copy, edit it, then publish it when the user approves.",
    );
  }
  return theme;
}

async function listFiles(projectId: string, themeId: string) {
  const files: { filename: string; size: number | null }[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const data: {
      theme: {
        files: {
          nodes: { filename: string; size: string | number | null }[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    } = await shopifyGraphql(
      projectId,
      `query MericSeoThemeFileList($id: ID!, $after: String) {
        theme(id: $id) {
          files(first: 250, after: $after) {
            nodes { filename size }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { id: toThemeGid(themeId), after },
    );
    if (!data.theme) throw new AppError("NOT_FOUND", "Theme not found.");
    files.push(
      ...data.theme.files.nodes.map((node) => ({
        filename: node.filename,
        size: node.size === null ? null : Number(node.size),
      })),
    );
    if (!data.theme.files.pageInfo.hasNextPage) break;
    after = data.theme.files.pageInfo.endCursor;
  }
  return files;
}

type ThemeFileBody =
  | { __typename: "OnlineStoreThemeFileBodyText"; content: string }
  | { __typename: "OnlineStoreThemeFileBodyBase64"; contentBase64: string }
  | { __typename: "OnlineStoreThemeFileBodyUrl"; url: string };

async function readFiles(
  projectId: string,
  themeId: string,
  filenames: string[],
) {
  const data = await shopifyGraphql<{
    theme: {
      files: {
        nodes: {
          filename: string;
          checksumMd5: string | null;
          body: ThemeFileBody;
        }[];
      };
    } | null;
  }>(
    projectId,
    `query MericSeoThemeFiles($id: ID!, $filenames: [String!]) {
      theme(id: $id) {
        files(filenames: $filenames, first: 50) {
          nodes {
            filename
            checksumMd5
            body {
              __typename
              ... on OnlineStoreThemeFileBodyText { content }
              ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
              ... on OnlineStoreThemeFileBodyUrl { url }
            }
          }
        }
      }
    }`,
    { id: toThemeGid(themeId), filenames },
  );
  if (!data.theme) throw new AppError("NOT_FOUND", "Theme not found.");
  return data.theme.files.nodes.map((node) => ({
    filename: node.filename,
    checksumMd5: node.checksumMd5,
    content:
      node.body.__typename === "OnlineStoreThemeFileBodyText"
        ? node.body.content
        : null,
    url:
      node.body.__typename === "OnlineStoreThemeFileBodyUrl"
        ? node.body.url
        : null,
    binary: node.body.__typename === "OnlineStoreThemeFileBodyBase64",
  }));
}

async function writeFiles(
  projectId: string,
  themeId: string,
  files: { filename: string; content: string }[],
) {
  const theme = await requireWritableTheme(projectId, themeId);
  const data = await shopifyGraphql<{
    themeFilesUpsert: {
      upsertedThemeFiles: { filename: string }[] | null;
      userErrors: {
        filename?: string | null;
        code?: string | null;
        message: string;
      }[];
    } | null;
  }>(
    projectId,
    `mutation MericSeoThemeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        upsertedThemeFiles { filename }
        userErrors { filename code message }
      }
    }`,
    {
      themeId: theme.id,
      files: files.map((file) => ({
        filename: file.filename,
        body: { type: "TEXT", value: file.content },
      })),
    },
  );
  const errors = data.themeFilesUpsert?.userErrors ?? [];
  if (errors.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Theme file save failed: ${errors.map((error) => `${error.filename ?? ""} ${error.message}`.trim()).join("; ")}`,
    );
  }
  return {
    themeId: theme.id,
    themeName: theme.name,
    saved:
      data.themeFilesUpsert?.upsertedThemeFiles?.map((file) => file.filename) ??
      [],
  };
}

async function deleteFiles(
  projectId: string,
  themeId: string,
  filenames: string[],
) {
  const theme = await requireWritableTheme(projectId, themeId);
  const data = await shopifyGraphql<{
    themeFilesDelete: {
      deletedThemeFiles: { filename: string }[] | null;
      userErrors: { filename?: string | null; message: string }[];
    } | null;
  }>(
    projectId,
    `mutation MericSeoThemeFilesDelete($themeId: ID!, $files: [String!]!) {
      themeFilesDelete(themeId: $themeId, files: $files) {
        deletedThemeFiles { filename }
        userErrors { filename message }
      }
    }`,
    { themeId: theme.id, files: filenames },
  );
  const errors = data.themeFilesDelete?.userErrors ?? [];
  if (errors.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Theme file delete failed: ${errors.map((error) => `${error.filename ?? ""} ${error.message}`.trim()).join("; ")}`,
    );
  }
  return {
    themeId: theme.id,
    deleted:
      data.themeFilesDelete?.deletedThemeFiles?.map((file) => file.filename) ??
      [],
  };
}

async function publishTheme(projectId: string, themeId: string) {
  const connection = await requireShopifyConnection(projectId);
  const theme = await getTheme(projectId, themeId);
  if (theme.role === "MAIN") return withLinks(theme, connection.shopDomain);
  const data = await shopifyGraphql<{
    themePublish: { theme: ThemeNode | null; userErrors: UserError[] } | null;
  }>(
    projectId,
    `mutation MericSeoThemePublish($id: ID!) {
      themePublish(id: $id) {
        theme { ${THEME_FIELDS} }
        userErrors { field message }
      }
    }`,
    { id: theme.id },
  );
  throwOnUserErrors(data.themePublish?.userErrors, "Theme publish");
  return withLinks(data.themePublish?.theme ?? theme, connection.shopDomain);
}

export const ShopifyThemeService = {
  listThemes,
  createCopy,
  renameCopy,
  listFiles,
  readFiles,
  writeFiles,
  deleteFiles,
  publishTheme,
};
