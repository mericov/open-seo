import { AppError } from "@/server/lib/errors";
import {
  shopifyGraphql,
  throwOnUserErrors,
} from "@/server/features/shopify/services/shopifyClient";
import type { ShopifySeoResource } from "@/shared/shopify";

type UserError = { field?: string[] | null; message: string };

const SEO_FIELDS = `
  titleTag: metafield(namespace: "global", key: "title_tag") { value }
  descriptionTag: metafield(namespace: "global", key: "description_tag") { value }
`;

const LIST_QUERIES: Record<ShopifySeoResource, string> = {
  product: `query MericSeoProducts($first: Int!, $after: String, $query: String) {
    items: products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes { id title handle onlineStoreUrl seo { title description } ${SEO_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  collection: `query MericSeoCollections($first: Int!, $after: String, $query: String) {
    items: collections(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes { id title handle seo { title description } ${SEO_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  page: `query MericSeoPages($first: Int!, $after: String, $query: String) {
    items: pages(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes { id title handle ${SEO_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  article: `query MericSeoArticles($first: Int!, $after: String, $query: String) {
    items: articles(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes { id title handle blog { handle } ${SEO_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }`,
};

type SeoNode = {
  id: string;
  title: string;
  handle: string;
  onlineStoreUrl?: string | null;
  blog?: { handle: string } | null;
  seo?: { title: string | null; description: string | null } | null;
  titleTag?: { value: string } | null;
  descriptionTag?: { value: string } | null;
};

function pathFor(resource: ShopifySeoResource, node: SeoNode) {
  if (resource === "product") return `/products/${node.handle}`;
  if (resource === "collection") return `/collections/${node.handle}`;
  if (resource === "page") return `/pages/${node.handle}`;
  return `/blogs/${node.blog?.handle ?? "news"}/${node.handle}`;
}

async function listSeo(
  projectId: string,
  resource: ShopifySeoResource,
  options: { search?: string; after?: string | null; first?: number },
) {
  const data = await shopifyGraphql<{
    items: {
      nodes: SeoNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(projectId, LIST_QUERIES[resource], {
    first: options.first ?? 50,
    after: options.after ?? null,
    query: options.search?.trim() || null,
  });
  return {
    items: data.items.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      path: pathFor(resource, node),
      seoTitle: node.titleTag?.value ?? node.seo?.title ?? null,
      seoDescription:
        node.descriptionTag?.value ?? node.seo?.description ?? null,
    })),
    nextCursor: data.items.pageInfo.hasNextPage
      ? data.items.pageInfo.endCursor
      : null,
  };
}

async function updateSeo(
  projectId: string,
  updates: {
    id: string;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }[],
) {
  const toSet: Record<string, string>[] = [];
  const toDelete: Record<string, string>[] = [];
  for (const update of updates) {
    if (!update.id.startsWith("gid://shopify/")) {
      throw new AppError("VALIDATION_ERROR", `Not a Shopify ID: ${update.id}`);
    }
    for (const [key, value] of [
      ["title_tag", update.seoTitle],
      ["description_tag", update.seoDescription],
    ] as const) {
      if (value === undefined) continue;
      const target = { ownerId: update.id, namespace: "global", key };
      if (value === null || value.trim() === "") toDelete.push(target);
      else
        toSet.push({
          ...target,
          type: "single_line_text_field",
          value: value.trim(),
        });
    }
  }
  for (let i = 0; i < toSet.length; i += 25) {
    const data = await shopifyGraphql<{
      metafieldsSet: { userErrors: UserError[] } | null;
    }>(
      projectId,
      `mutation MericSeoSeoSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { userErrors { field message } }
      }`,
      { metafields: toSet.slice(i, i + 25) },
    );
    throwOnUserErrors(data.metafieldsSet?.userErrors, "SEO update");
  }
  if (toDelete.length > 0) {
    const data = await shopifyGraphql<{
      metafieldsDelete: { userErrors: UserError[] } | null;
    }>(
      projectId,
      `mutation MericSeoSeoDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) { userErrors { field message } }
      }`,
      { metafields: toDelete },
    );
    throwOnUserErrors(data.metafieldsDelete?.userErrors, "SEO clear");
  }
  return { updated: updates.length };
}

type FileNode = {
  id: string;
  fileStatus: string;
  alt?: string | null;
  image?: { url: string } | null;
  url?: string | null;
};

const FILE_FIELDS = `
  id fileStatus alt
  ... on MediaImage { image { url } }
  ... on GenericFile { url }
`;

const isDone = (file: FileNode) =>
  file.fileStatus === "FAILED" ||
  (file.fileStatus === "READY" && Boolean(file.image?.url ?? file.url));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadImages(
  projectId: string,
  images: { url: string; alt?: string | null; filename?: string | null }[],
) {
  if (images.length === 0) return [];
  for (const image of images) {
    if (!/^https?:\/\//i.test(image.url)) {
      throw new AppError("VALIDATION_ERROR", `Not an image URL: ${image.url}`);
    }
  }
  const data = await shopifyGraphql<{
    fileCreate: { files: FileNode[] | null; userErrors: UserError[] } | null;
  }>(
    projectId,
    `mutation MericSeoFileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { ${FILE_FIELDS} }
        userErrors { field message }
      }
    }`,
    {
      files: images.map((image) => ({
        originalSource: image.url,
        contentType: "IMAGE",
        ...(image.alt ? { alt: image.alt.slice(0, 512) } : {}),
        ...(image.filename ? { filename: image.filename } : {}),
      })),
    },
  );
  throwOnUserErrors(data.fileCreate?.userErrors, "Image upload");
  let files = data.fileCreate?.files ?? [];
  for (let attempt = 0; attempt < 20 && !files.every(isDone); attempt++) {
    await sleep(1500);
    const polled = await shopifyGraphql<{ nodes: (FileNode | null)[] }>(
      projectId,
      `query MericSeoFileStatus($ids: [ID!]!) { nodes(ids: $ids) { ... on File { ${FILE_FIELDS} } } }`,
      { ids: files.map((file) => file.id) },
    );
    files = files.map(
      (file) => polled.nodes.find((node) => node?.id === file.id) ?? file,
    );
  }
  return images.map((image, index) => {
    const file = files[index];
    return {
      sourceUrl: image.url,
      fileId: file?.id ?? null,
      status: file?.fileStatus ?? "FAILED",
      url: file?.image?.url ?? file?.url ?? null,
      alt: image.alt ?? null,
    };
  });
}

export const ShopifyContentService = {
  listSeo,
  updateSeo,
  uploadImages,
};
