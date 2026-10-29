import { AppError } from "@/server/lib/errors";
import { BlogDraftRepository } from "@/server/features/blog-writer/repositories/BlogDraftRepository";
import { fetchUntrusted } from "@/server/features/social/services/SocialMediaService";
import { verifySiteUrl } from "@/server/features/social/services/siteUrls";

const MAX_TEXT = 12_000;

function htmlToText(html: string) {
  const main =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html;
  return main
    .replace(
      /<(script|style|nav|footer|header|form|noscript)[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, MAX_TEXT);
}

function imagesIn(html: string) {
  return [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)]
    .map((match) => match[1] ?? "")
    .map((src) => (src.startsWith("//") ? `https:${src}` : src))
    .filter((src) => src.startsWith("https://"))
    .slice(0, 12);
}

export async function loadBlogSource(
  projectId: string,
  input: { draftId?: string; url?: string },
) {
  const drafts = await BlogDraftRepository.list(projectId);
  const match = input.draftId
    ? drafts.find((draft) => draft.id === input.draftId)
    : drafts.find((draft) => draft.publishedUrl === input.url);
  if (match) {
    const draft = await BlogDraftRepository.get(projectId, match.id);
    if (draft)
      return {
        title: draft.title,
        url: draft.publishedUrl,
        targetKeyword: draft.targetKeyword,
        text: htmlToText(draft.contentHtml),
        images: imagesIn(draft.contentHtml),
      };
  }
  if (!input.url)
    throw new AppError(
      "NOT_FOUND",
      "Blog draft not found. Pass its URL instead.",
    );
  const url = await verifySiteUrl(projectId, input.url);
  const { response } = await fetchUntrusted(url);
  const html = await response.text();
  return {
    title: html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? url,
    url,
    targetKeyword: null,
    text: htmlToText(html),
    images: imagesIn(html),
  };
}
