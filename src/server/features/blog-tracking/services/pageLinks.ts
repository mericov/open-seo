import { sort } from "remeda";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { fetchBody } from "@/server/lib/leads/siteFetch";
import { BlogPostRepository } from "@/server/features/blog-tracking/repositories/BlogPostRepository";
import { PageTrackingRepository } from "@/server/features/blog-tracking/repositories/PageTrackingRepository";
import { normalizePageUrl } from "@/server/features/blog-tracking/services/blogTrackingReport";
import {
  analyzePage,
  type KeywordRow,
  type PageAnalysisResult,
} from "@/server/features/blog-tracking/services/pageChecks";
import {
  classifyPath,
  labelFor,
  relevanceFor,
  tokens,
} from "@/server/features/blog-writer/services/siteLinkTargets";

const OUTBOUND_SUGGESTIONS = 6;
const INBOUND_CANDIDATES = 5;
const KIND_BONUS = 0.25;

export type TrackedPost = NonNullable<
  Awaited<ReturnType<typeof BlogPostRepository.get>>
>;

type LinkCandidate = {
  url: string;
  key: string;
  label: string;
  kind: "blog" | "category" | "product";
};

export async function fetchHtml(url: string) {
  try {
    const validated = await normalizeAndValidateStartUrl(url);
    return (await fetchBody(validated, "html"))?.body ?? null;
  } catch {
    return null;
  }
}

async function linkCandidates(projectId: string, post: TrackedPost) {
  const [posts, latest] = await Promise.all([
    BlogPostRepository.list(projectId),
    PageTrackingRepository.latestWeek(projectId),
  ]);
  const ownKey = normalizePageUrl(post.url);
  const candidates = new Map<string, LinkCandidate>();
  for (const other of posts) {
    const key = normalizePageUrl(other.url);
    if (key === ownKey) continue;
    let label = other.title ?? other.url;
    if (!other.title) {
      try {
        label = labelFor(new URL(other.url).pathname);
      } catch {
        label = other.url;
      }
    }
    candidates.set(key, { url: other.url, key, label, kind: other.kind });
  }
  const pageKeys = latest
    ? await PageTrackingRepository.listWeekPageKeys(projectId, latest)
    : [];
  for (const key of pageKeys) {
    if (key === ownKey || candidates.has(key)) continue;
    let pathname: string;
    try {
      pathname = new URL(key).pathname;
    } catch {
      continue;
    }
    const kind = classifyPath(pathname);
    if (kind !== "product" && kind !== "category") continue;
    candidates.set(key, { url: key, key, label: labelFor(pathname), kind });
  }
  return [...candidates.values()];
}

export async function linkSuggestions(
  projectId: string,
  post: TrackedPost,
  page: PageAnalysisResult | null,
  keywords: KeywordRow[] | null,
) {
  const topic = [
    post.targetKeyword,
    ...(keywords ?? []).slice(0, 3).map((row) => row.query),
    post.title ?? page?.h1 ?? page?.title,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const topicTokens = [...new Set(tokens(topic))];
  if (topicTokens.length === 0) return { outbound: [], inbound: [] };
  const scored = (await linkCandidates(projectId, post))
    .map((candidate) => ({
      ...candidate,
      relevance: relevanceFor(candidate.label, topicTokens),
    }))
    .filter((candidate) => candidate.relevance > 0);
  const preferred = post.kind === "blog" ? ["category", "product"] : ["blog"];
  const outbound = page
    ? sort(
        scored
          .filter((candidate) => !page.linkedKeys.has(candidate.key))
          .map((candidate) => ({
            ...candidate,
            score:
              candidate.relevance +
              (preferred.includes(candidate.kind) ? KIND_BONUS : 0),
          })),
        (a, b) => b.score - a.score,
      )
        .slice(0, OUTBOUND_SUGGESTIONS)
        .map(({ url, label, kind }) => ({ url, label, kind }))
    : [];
  const ownKey = normalizePageUrl(post.url);
  const inboundCandidates = sort(
    scored.filter((candidate) => candidate.kind === "blog"),
    (a, b) => b.relevance - a.relevance,
  ).slice(0, INBOUND_CANDIDATES);
  const inbound = (
    await Promise.all(
      inboundCandidates.map(async (candidate) => {
        const html = await fetchHtml(candidate.url);
        if (!html) return null;
        const linked = analyzePage({
          html,
          url: candidate.url,
          kind: "blog",
          today: new Date(),
        }).linkedKeys.has(ownKey);
        return linked
          ? null
          : {
              url: candidate.url,
              label: candidate.label,
              kind: candidate.kind,
            };
      }),
    )
  ).filter((value) => value !== null);
  return { outbound, inbound };
}
