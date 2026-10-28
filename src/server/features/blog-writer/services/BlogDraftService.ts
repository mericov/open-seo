import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { BlogPostRepository } from "@/server/features/blog-tracking/repositories/BlogPostRepository";
import { BlogDraftRepository } from "@/server/features/blog-writer/repositories/BlogDraftRepository";
import {
  buildFaqSchema,
  buildPublishHtml,
  countWords,
  sanitizeBlogHtml,
  slugify,
  type BlogFaq,
} from "@/server/features/blog-writer/services/blogHtml";
import { discoverLinkTargets } from "@/server/features/blog-writer/services/siteLinkTargets";
import { BLOG_WRITER_WORKFLOW } from "@/server/features/blog-writer/services/blogWriterWorkflow";
import {
  GscNotConnectedError,
  GscService,
  isExpectedGrantFailure,
} from "@/server/features/gsc/services/GscService";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import { buildStrikingDistanceRows } from "@/server/features/gsc/searchPerformanceReport";
import { KeywordResearchService } from "@/server/features/keywords/services/KeywordResearchService";
import { ProjectContextService } from "@/server/features/project-context/services/ProjectContextService";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import {
  blogFaqSchema,
  blogImageSuggestionSchema,
  blogInternalLinkSchema,
  type BlogDraftContent,
} from "@/types/schemas/blog-writer";

type Author = "user" | "sam" | "mcp";

const STRIKING_FETCH_LIMIT = 2000;
const STRIKING_LIMIT = 40;
const SAVED_KEYWORD_LIMIT = 50;
const RECENT_FORMAT_LIMIT = 6;

const FAQ_HEADINGS: Record<string, string> = {
  tr: "Sıkça Sorulan Sorular",
  en: "Frequently Asked Questions",
  de: "Häufig gestellte Fragen",
  fr: "Questions fréquentes",
  es: "Preguntas frecuentes",
};

function faqHeading(languageCode: string | null) {
  const base = (languageCode ?? "en").toLowerCase().split("-")[0] ?? "en";
  return FAQ_HEADINGS[base] ?? FAQ_HEADINGS.en ?? "FAQ";
}

function parseJsonArray<T>(value: string | null, schema: z.ZodType<T>): T[] {
  if (!value) return [];
  try {
    const parsed = z.array(schema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function normalizeKeyword(value: string) {
  return value.trim().toLocaleLowerCase();
}

async function requireProject(projectId: string) {
  const project = await ProjectRepository.getProjectById(projectId);
  if (!project) throw new AppError("NOT_FOUND");
  return project;
}

async function listTargetedKeywords(projectId: string) {
  const [posts, drafts] = await Promise.all([
    BlogPostRepository.list(projectId),
    BlogDraftRepository.list(projectId),
  ]);
  return [
    ...posts
      .filter((post) => post.targetKeyword)
      .map((post) => ({
        keyword: post.targetKeyword ?? "",
        draftId: null,
        source: "tracked_post" as const,
        url: post.url,
        title: post.title,
      })),
    ...drafts.map((draft) => ({
      keyword: draft.targetKeyword,
      draftId: draft.id,
      source:
        draft.status === "published"
          ? ("published_draft" as const)
          : ("draft" as const),
      url: draft.publishedUrl,
      title: draft.title,
    })),
  ];
}

async function getStrikingDistance(projectId: string) {
  const { startDate, endDate } = resolveDateRange({
    dateRange: "last_3_months",
  });
  try {
    const result = await GscService.getPerformance({
      projectId,
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: STRIKING_FETCH_LIMIT,
    });
    return {
      connected: true as const,
      rows: buildStrikingDistanceRows(result.rows, STRIKING_LIMIT),
    };
  } catch (error) {
    if (
      error instanceof GscNotConnectedError ||
      isExpectedGrantFailure(error)
    ) {
      return { connected: false as const, rows: [] };
    }
    throw error;
  }
}

async function getRecentFormats(projectId: string) {
  const rows = await BlogDraftRepository.listRecentNotes(
    projectId,
    RECENT_FORMAT_LIMIT,
  );
  return rows.map((row) => ({
    title: row.title,
    format:
      row.researchNotes
        ?.split("\n")
        .find((line) => line.trim().toLowerCase().startsWith("format:"))
        ?.trim() ?? null,
  }));
}

async function getStartBrief(projectId: string) {
  const project = await requireProject(projectId);
  const [context, striking, saved, targeted, recentFormats] = await Promise.all(
    [
      ProjectContextService.getProjectContext(projectId),
      getStrikingDistance(projectId),
      KeywordResearchService.getSavedKeywords({
        projectId,
        page: 1,
        pageSize: SAVED_KEYWORD_LIMIT,
        sort: "searchVolume",
        order: "desc",
      }),
      listTargetedKeywords(projectId),
      getRecentFormats(projectId),
    ],
  );

  return {
    workflow: BLOG_WRITER_WORKFLOW,
    project: {
      id: project.id,
      name: project.name,
      domain: project.domain,
      locationCode: project.locationCode,
      languageCode: project.languageCode,
    },
    contextMarkdown:
      ProjectContextService.renderProjectContextMarkdown(context),
    searchConsole: striking,
    savedKeywords: saved.rows.map((row) => ({
      keyword: row.keyword,
      searchVolume: row.searchVolume,
      keywordDifficulty: row.keywordDifficulty,
      cpc: row.cpc,
      intent: row.intent,
    })),
    alreadyTargeted: targeted,
    recentFormats,
  };
}

async function getLinkTargets(projectId: string, topic?: string) {
  const project = await requireProject(projectId);
  if (!project.domain) throw new AppError("VALIDATION_ERROR");
  const [targets, posts] = await Promise.all([
    discoverLinkTargets(project.domain, topic),
    BlogPostRepository.list(projectId),
  ]);
  return {
    ...targets,
    trackedPosts: posts.map((post) => ({
      url: post.url,
      title: post.title,
      targetKeyword: post.targetKeyword,
    })),
  };
}

function toDraftValues(content: BlogDraftContent, author: Author) {
  const contentHtml = sanitizeBlogHtml(content.contentHtml);
  return {
    targetKeyword: content.targetKeyword,
    secondaryKeywords: content.secondaryKeywords.join("\n") || null,
    languageCode: content.languageCode ?? null,
    title: content.title,
    metaTitle: content.metaTitle ?? null,
    metaDescription: content.metaDescription ?? null,
    slug: slugify(content.slug || content.title) || null,
    excerpt: content.excerpt ?? null,
    contentHtml,
    faqJson: content.faqs.length > 0 ? JSON.stringify(content.faqs) : null,
    imageSuggestionsJson:
      content.imageSuggestions.length > 0
        ? JSON.stringify(content.imageSuggestions)
        : null,
    internalLinksJson:
      content.internalLinks.length > 0
        ? JSON.stringify(content.internalLinks)
        : null,
    researchNotes: content.researchNotes ?? null,
    wordCount: countWords(contentHtml),
    updatedBy: author,
  };
}

async function findCannibalization(
  projectId: string,
  keyword: string,
  ignoreDraftId?: string,
) {
  const normalized = normalizeKeyword(keyword);
  const targeted = await listTargetedKeywords(projectId);
  return targeted
    .filter(
      (item) =>
        normalizeKeyword(item.keyword) === normalized &&
        (!ignoreDraftId || item.draftId !== ignoreDraftId),
    )
    .map(({ draftId: _draftId, ...item }) => item);
}

async function saveDraft(
  projectId: string,
  content: BlogDraftContent & { draftId?: string },
  author: Author,
) {
  await requireProject(projectId);
  const values = toDraftValues(content, author);
  const conflicts = await findCannibalization(
    projectId,
    content.targetKeyword,
    content.draftId,
  );
  if (content.draftId) {
    const existing = await BlogDraftRepository.get(projectId, content.draftId);
    if (!existing) throw new AppError("NOT_FOUND");
    const { imageSuggestionsJson, ...rest } = values;
    await BlogDraftRepository.update(
      projectId,
      content.draftId,
      imageSuggestionsJson ? values : rest,
    );
    return { id: content.draftId, wordCount: values.wordCount, conflicts };
  }
  const id = await BlogDraftRepository.create(projectId, values);
  return { id, wordCount: values.wordCount, conflicts };
}

async function getDraft(projectId: string, id: string) {
  const draft = await BlogDraftRepository.get(projectId, id);
  if (!draft) throw new AppError("NOT_FOUND");
  const faqs: BlogFaq[] = parseJsonArray(draft.faqJson, blogFaqSchema);
  const heading = faqHeading(draft.languageCode);
  return {
    ...draft,
    secondaryKeywords: draft.secondaryKeywords
      ? draft.secondaryKeywords.split("\n").filter(Boolean)
      : [],
    faqs,
    faqHeading: heading,
    imageSuggestions: parseJsonArray(
      draft.imageSuggestionsJson,
      blogImageSuggestionSchema,
    ),
    internalLinks: parseJsonArray(
      draft.internalLinksJson,
      blogInternalLinkSchema,
    ),
    publishHtml: buildPublishHtml(draft.contentHtml, faqs, heading),
    faqSchema: faqs.length > 0 ? buildFaqSchema(faqs) : null,
  };
}

async function listDrafts(projectId: string) {
  return BlogDraftRepository.list(projectId);
}

async function deleteDraft(projectId: string, id: string) {
  await BlogDraftRepository.remove(projectId, id);
  return { ok: true as const };
}

async function updateMeta(
  projectId: string,
  id: string,
  meta: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    slug: string;
  },
) {
  const draft = await BlogDraftRepository.get(projectId, id);
  if (!draft) throw new AppError("NOT_FOUND");
  await BlogDraftRepository.update(projectId, id, {
    title: meta.title,
    metaTitle: meta.metaTitle || null,
    metaDescription: meta.metaDescription || null,
    slug: slugify(meta.slug || meta.title) || null,
    updatedBy: "user",
  });
  return { ok: true as const };
}

async function markPublished(
  projectId: string,
  id: string,
  publishedUrl: string,
) {
  const draft = await BlogDraftRepository.get(projectId, id);
  if (!draft) throw new AppError("NOT_FOUND");
  await BlogDraftRepository.update(projectId, id, {
    status: "published",
    publishedUrl,
    updatedBy: "user",
  });
  await BlogPostRepository.upsert(projectId, [
    {
      url: publishedUrl,
      title: draft.title,
      targetKeyword: draft.targetKeyword,
      publishedAt: new Date().toISOString().slice(0, 10),
      kind: "blog",
    },
  ]);
  return { ok: true as const };
}

export const BlogDraftService = {
  getStartBrief,
  getLinkTargets,
  saveDraft,
  getDraft,
  listDrafts,
  deleteDraft,
  updateMeta,
  markPublished,
};
