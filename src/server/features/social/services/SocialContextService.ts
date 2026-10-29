import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import { discoverLinkTargets } from "@/server/features/blog-writer/services/siteLinkTargets";
import { KeywordResearchService } from "@/server/features/keywords/services/KeywordResearchService";
import { ProjectContextService } from "@/server/features/project-context/services/ProjectContextService";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { ShopifyConnectionRepository } from "@/server/features/shopify/repositories/ShopifyConnectionRepository";
import { SocialContextRepository } from "@/server/features/social/repositories/SocialContextRepository";
import { BrandKitService } from "@/server/features/social/services/BrandKitService";
import {
  loadAnalytics,
  loadContentHistory,
  loadRankTracking,
  loadSearchConsole,
} from "@/server/features/social/services/socialContextSources";
import { renderSocialContext } from "@/server/features/social/services/socialContextRender";
import { MetaConnectionService } from "@/server/features/social/services/MetaConnectionService";
import {
  loadShopifyCatalog,
  loadShopifyMenu,
} from "@/server/features/social/services/shopifySiteData";
import { TURKEY_LOCATION_CODE } from "@/shared/social";

const CACHE_VERSION = "v1";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_SECONDS = 3 * 24 * 60 * 60;

const cacheKey = (projectId: string) =>
  `social-context:${CACHE_VERSION}:${projectId}`;

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function attempt<T>(
  label: string,
  missing: string[],
  run: () => Promise<T>,
): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    missing.push(`${label}: ${message(error)}`);
    return null;
  }
}

function originFor(domain: string) {
  const host = domain.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return `https://${host.toLowerCase()}`;
}

function marketFor(locationCode: number) {
  if (locationCode === TURKEY_LOCATION_CODE) return "TR";
  return locationCode === 2840 ? "US" : String(locationCode);
}

async function loadSite(
  projectId: string,
  hasShopify: boolean,
  origin: string | null,
  missing: string[],
) {
  if (!origin)
    return {
      source: "none" as const,
      collections: [],
      products: [],
      pages: [],
      menu: [],
      articles: [],
    };
  if (hasShopify) {
    const [catalog, menu] = await Promise.all([
      attempt("Shopify catalog", missing, () =>
        loadShopifyCatalog(projectId, origin),
      ),
      attempt(
        "Shopify menu (needs read_online_store_navigation)",
        missing,
        () => loadShopifyMenu(projectId, origin),
      ),
    ]);
    return {
      source: "shopify" as const,
      collections: catalog?.collections ?? [],
      products: catalog?.products ?? [],
      pages: catalog?.pages ?? [],
      menu: menu ?? [],
      articles: catalog?.articles ?? [],
    };
  }
  const crawl = await attempt("site crawl", missing, () =>
    discoverLinkTargets(origin),
  );
  return {
    source: "crawl" as const,
    collections: (crawl?.categories ?? []).map((row) => ({
      title: row.label,
      url: row.url,
      description: null as string | null,
      image: null as string | null,
    })),
    products: (crawl?.products ?? []).map((row) => ({
      title: row.label,
      url: row.url,
      type: null as string | null,
      tags: [] as string[],
      price: null as string | null,
      images: [] as string[],
    })),
    pages: (crawl?.pages ?? []).map((row) => ({
      title: row.label,
      url: row.url,
    })),
    menu: [] as { title: string; url: string }[],
    articles: (crawl?.blogPosts ?? []).map((row) => ({
      title: row.label,
      url: row.url,
      publishedAt: null as string | null,
      tags: [] as string[],
      image: null as string | null,
    })),
  };
}

async function build(projectId: string) {
  const project = await ProjectRepository.getProjectById(projectId);
  if (!project) throw new AppError("NOT_FOUND");
  const missing: string[] = [];
  const [context, brandKit, meta, shopify] = await Promise.all([
    ProjectContextService.getProjectContext(projectId),
    BrandKitService.get(projectId),
    MetaConnectionService.getConnection(projectId),
    ShopifyConnectionRepository.getByProjectId(projectId),
  ]);
  const origin = shopify?.primaryDomain
    ? originFor(shopify.primaryDomain)
    : project.domain
      ? originFor(project.domain)
      : null;
  if (!origin) missing.push("site: project has no domain");

  const [
    saved,
    tracked,
    searchConsole,
    analytics,
    site,
    history,
    aiPrompts,
    aiVisibility,
  ] = await Promise.all([
    attempt("saved keywords", missing, () =>
      KeywordResearchService.getSavedKeywords({
        projectId,
        page: 1,
        pageSize: 50,
        sort: "searchVolume",
        order: "desc",
      }),
    ),
    attempt("rank tracker", missing, () => loadRankTracking(projectId)),
    attempt("Search Console", missing, () => loadSearchConsole(projectId)),
    attempt("GA4", missing, () => loadAnalytics(projectId)),
    loadSite(projectId, shopify !== null, origin, missing),
    loadContentHistory(projectId),
    attempt("AI visibility prompts", missing, () =>
      SocialContextRepository.listAiPrompts(projectId, 30),
    ),
    attempt("AI visibility results", missing, () =>
      SocialContextRepository.latestAiRunVisibility(projectId),
    ),
  ]);

  if (!shopify)
    missing.push(
      "Shopify: not connected, site structure comes from a sitemap crawl",
    );
  if (!brandKit) missing.push("brand kit: not filled in yet");
  if (!meta.connected)
    missing.push("Meta: not connected, publishing is unavailable");
  if (saved && saved.rows.length === 0) missing.push("saved keywords: none");
  if (tracked && tracked.length === 0)
    missing.push("rank tracker: no tracked keywords");
  if (aiPrompts && aiPrompts.length === 0)
    missing.push("AI visibility: no tracked prompts");
  missing.push(
    "domain ranked keywords: not cached (no paid DataForSEO call is made for context); Search Console queries are used instead",
    "SERP competitors: not stored; using the project's own competitor list",
  );

  return {
    builtAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      domain: project.domain,
      origin,
      languageCode: project.languageCode,
      locationCode: project.locationCode,
      market: marketFor(project.locationCode),
      timezone: meta.timezone,
    },
    brand: {
      contextMarkdown:
        ProjectContextService.renderProjectContextMarkdown(context),
      kit: brandKit,
    },
    keywords: {
      saved:
        saved?.rows.map((row) => ({
          keyword: row.keyword,
          searchVolume: row.searchVolume,
          keywordDifficulty: row.keywordDifficulty,
          intent: row.intent,
        })) ?? [],
      tracked: tracked ?? [],
    },
    search: { searchConsole, analytics },
    site,
    content: history,
    competitors: context.competitors.map((row) => ({
      domain: row.domain,
      name: row.name,
      notes: row.notes,
    })),
    aiVisibility: {
      prompts: aiPrompts ?? [],
      latest: aiVisibility,
    },
    performance: [] as { label: string; value: string }[],
    missing,
  };
}

export type SocialContext = Awaited<ReturnType<typeof build>>;

async function get(projectId: string, options: { refresh?: boolean } = {}) {
  if (!options.refresh) {
    const cached = await env.KV.get<SocialContext>(cacheKey(projectId), "json");
    if (cached && Date.now() - Date.parse(cached.builtAt) < CACHE_MAX_AGE_MS)
      return cached;
  }
  const context = await build(projectId);
  await env.KV.put(cacheKey(projectId), JSON.stringify(context), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return context;
}

async function invalidate(projectId: string) {
  await env.KV.delete(cacheKey(projectId));
}

function knownUrls(context: SocialContext) {
  const urls = [
    ...context.site.collections.map((row) => row.url),
    ...context.site.products.map((row) => row.url),
    ...context.site.pages.map((row) => row.url),
    ...context.site.articles.map((row) => row.url),
    ...context.site.menu.map((row) => row.url),
  ];
  if (context.project.origin) urls.push(`${context.project.origin}/`);
  return [...new Set(urls)];
}

export const SocialContextService = {
  get,
  invalidate,
  render: renderSocialContext,
  knownUrls,
};
