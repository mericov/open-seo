import { AppError } from "@/server/lib/errors";
import { BlogDraftService } from "@/server/features/blog-writer/services/BlogDraftService";
import { triggerUnsplashDownload } from "@/server/features/blog-writer/services/stockImages";
import { ShopifyConnectionRepository } from "@/server/features/shopify/repositories/ShopifyConnectionRepository";
import { ShopifyContentService } from "@/server/features/shopify/services/ShopifyContentService";
import {
  requireShopifyConnection,
  shopifyGraphql,
  throwOnUserErrors,
} from "@/server/features/shopify/services/shopifyClient";

type UserError = { field?: string[] | null; message: string };

type BlogNode = { id: string; title: string; handle: string };

async function listBlogs(projectId: string) {
  const data = await shopifyGraphql<{ blogs: { nodes: BlogNode[] } }>(
    projectId,
    `query MericSeoBlogs { blogs(first: 50) { nodes { id title handle } } }`,
  );
  return data.blogs.nodes;
}

const unescapeAttribute = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function isShopifyCdn(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "cdn.shopify.com" || host.endsWith(".shopify.com");
  } catch {
    return false;
  }
}

async function moveImagesToShopify(
  projectId: string,
  html: string,
  featured: { url: string; alt: string } | null,
  altBySource: Map<string, string>,
) {
  const sources = [
    ...new Set(
      [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) =>
        unescapeAttribute(match[1] ?? ""),
      ),
    ),
  ].filter((url) => /^https?:\/\//i.test(url) && !isShopifyCdn(url));
  const featuredSource =
    featured && !isShopifyCdn(featured.url) && !sources.includes(featured.url)
      ? featured.url
      : null;
  const uploads = [...sources, ...(featuredSource ? [featuredSource] : [])];
  const results = await ShopifyContentService.uploadImages(
    projectId,
    uploads.map((url) => ({
      url,
      alt:
        url === featured?.url ? featured.alt : (altBySource.get(url) ?? null),
    })),
  );
  const replaced = new Map(
    results
      .filter((result) => result.url)
      .map((result) => [result.sourceUrl, result.url!] as const),
  );
  let output = html;
  for (const [from, to] of replaced) {
    output = output
      .split(`src="${escapeAttribute(from)}"`)
      .join(`src="${escapeAttribute(to)}"`);
  }
  return {
    html: output,
    featuredUrl: featured ? (replaced.get(featured.url) ?? featured.url) : null,
    uploaded: results,
  };
}

async function publishDraft(
  projectId: string,
  draftId: string,
  options: { blogId?: string; publish?: boolean; author?: string },
) {
  const connection = await requireShopifyConnection(projectId);
  const draft = await BlogDraftService.getDraft(projectId, draftId);
  const existing = await ShopifyConnectionRepository.getArticleForDraft(
    projectId,
    draftId,
  );
  const blogs = await listBlogs(projectId);
  const blog =
    blogs.find((item) => item.id === (options.blogId ?? existing?.blogId)) ??
    (options.blogId ? undefined : blogs[0]);
  if (!blog) {
    throw new AppError(
      "VALIDATION_ERROR",
      blogs.length === 0
        ? "This Shopify store has no blog yet. Create one under Online Store → Blog posts."
        : "Blog not found in this store.",
    );
  }

  const featuredImage =
    draft.imageSuggestions.find(
      (image) =>
        !image.inBody && image.url && /featured/i.test(image.placement),
    ) ?? draft.imageSuggestions.find((image) => !image.inBody && image.url);
  const altBySource = new Map(
    draft.imageSuggestions
      .filter((image) => image.url)
      .map((image) => [image.url!, image.alt] as const),
  );
  const moved = await moveImagesToShopify(
    projectId,
    draft.publishHtml,
    featuredImage?.url
      ? { url: featuredImage.url, alt: featuredImage.alt }
      : null,
    altBySource,
  );
  await Promise.all(
    draft.imageSuggestions
      .filter((image) =>
        image.downloadLocation?.startsWith("https://api.unsplash.com/"),
      )
      .map((image) => triggerUnsplashDownload(image.downloadLocation!)),
  );

  const isPublished = options.publish ?? true;
  const metafields = [
    ...(draft.metaTitle
      ? [
          {
            namespace: "global",
            key: "title_tag",
            type: "single_line_text_field",
            value: draft.metaTitle,
          },
        ]
      : []),
    ...(draft.metaDescription
      ? [
          {
            namespace: "global",
            key: "description_tag",
            type: "single_line_text_field",
            value: draft.metaDescription,
          },
        ]
      : []),
  ];
  const article = {
    title: draft.title,
    ...(draft.slug ? { handle: draft.slug } : {}),
    body: moved.html,
    ...(draft.excerpt ? { summary: draft.excerpt } : {}),
    isPublished,
    ...(moved.featuredUrl
      ? {
          image: {
            url: moved.featuredUrl,
            altText: featuredImage?.alt ?? draft.title,
          },
        }
      : {}),
    ...(metafields.length > 0 ? { metafields } : {}),
  };

  type ArticleResult = {
    article: {
      id: string;
      handle: string;
      blog: { handle: string } | null;
    } | null;
    userErrors: UserError[];
  } | null;
  let result: ArticleResult;
  if (existing) {
    const data = await shopifyGraphql<{ articleUpdate: ArticleResult }>(
      projectId,
      `mutation MericSeoArticleUpdate($id: ID!, $article: ArticleUpdateInput!) {
        articleUpdate(id: $id, article: $article) {
          article { id handle blog { handle } }
          userErrors { field message }
        }
      }`,
      { id: existing.articleId, article: { ...article, blogId: blog.id } },
    );
    result = data.articleUpdate;
    throwOnUserErrors(result?.userErrors, "Shopify article update");
  } else {
    const data = await shopifyGraphql<{ articleCreate: ArticleResult }>(
      projectId,
      `mutation MericSeoArticleCreate($article: ArticleCreateInput!) {
        articleCreate(article: $article) {
          article { id handle blog { handle } }
          userErrors { field message }
        }
      }`,
      {
        article: {
          ...article,
          blogId: blog.id,
          author: {
            name: options.author?.trim() || connection.shopName || "Admin",
          },
        },
      },
    );
    result = data.articleCreate;
    throwOnUserErrors(result?.userErrors, "Shopify article create");
  }
  const saved = result?.article;
  if (!saved) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Shopify did not return the article.",
    );
  }

  const host = connection.primaryDomain ?? connection.shopDomain;
  const url = `https://${host}/blogs/${saved.blog?.handle ?? blog.handle}/${saved.handle}`;
  await ShopifyConnectionRepository.saveArticleForDraft({
    projectId,
    draftId,
    articleId: saved.id,
    blogId: blog.id,
    url,
  });
  if (isPublished)
    await BlogDraftService.markPublished(projectId, draftId, url);

  return {
    articleId: saved.id,
    url,
    blog: { id: blog.id, title: blog.title },
    published: isPublished,
    updatedExisting: Boolean(existing),
    images: moved.uploaded,
  };
}

async function getPublishState(projectId: string, draftId: string) {
  const [connection, existing] = await Promise.all([
    ShopifyConnectionRepository.getByProjectId(projectId),
    ShopifyConnectionRepository.getArticleForDraft(projectId, draftId),
  ]);
  if (!connection) return { connected: false as const };
  return {
    connected: true as const,
    blogs: await listBlogs(projectId),
    article: existing
      ? { id: existing.articleId, blogId: existing.blogId, url: existing.url }
      : null,
  };
}

export const ShopifyBlogService = {
  listBlogs,
  publishDraft,
  getPublishState,
};
