import { MediaArticleRepository } from "@/server/features/digital-pr/repositories/MediaArticleRepository";
import { MediaScanRepository } from "@/server/features/digital-pr/repositories/MediaScanRepository";
import {
  createRobotsCache,
  readArticleAuthor,
} from "@/server/lib/digital-pr/articleAuthor";
import { readOutlet } from "@/server/lib/digital-pr/outletReader";
import { nameKey } from "@/server/lib/digital-pr/personNames";
import { MediaRepository } from "@/server/features/digital-pr/repositories/MediaRepository";

const OUTLETS_PER_CALL = 2;
const ARTICLES_PER_CALL = 4;
const CLAIM_STALE_MINUTES = 10;

async function enrichOutlets(organizationId?: string) {
  const now = new Date().toISOString();
  const staleBefore = new Date(
    Date.now() - CLAIM_STALE_MINUTES * 60 * 1000,
  ).toISOString();
  const outlets = await MediaRepository.claimPendingOutlets(
    OUTLETS_PER_CALL,
    now,
    staleBefore,
    organizationId,
  );
  for (const outlet of outlets) {
    const result = await readOutlet(outlet.domain).catch((error: unknown) => {
      console.error("[media-enrich] outlet read failed", {
        domain: outlet.domain,
        error,
      });
      return null;
    });
    await MediaRepository.saveOutletEnrichment(
      outlet.id,
      {
        status: result?.status ?? "failed",
        name: result?.name ?? null,
        type: result?.type ?? null,
        homepageUrl: result?.homepageUrl ?? null,
        mastheadUrl: result?.mastheadUrl ?? null,
        contactPageUrl: result?.contactPageUrl ?? null,
      },
      result?.contacts ?? [],
    );
  }
  return outlets.length;
}

async function enrichArticles(organizationId?: string) {
  const articles = await MediaArticleRepository.listPendingArticles(
    ARTICLES_PER_CALL,
    organizationId,
  );
  const robots = createRobotsCache();
  for (const article of articles) {
    const result = await readArticleAuthor(
      article.url,
      article.domain,
      robots,
    ).catch(() => null);
    if (!result || result.status === "failed" || !result.authorName) {
      await MediaArticleRepository.saveArticleAuthor(article.id, {
        status: result?.status ?? "failed",
        authorName: null,
        contactId: null,
      });
      continue;
    }
    const key = nameKey(result.authorName);
    await MediaArticleRepository.insertContacts(article.outletId, [
      {
        contactKey: key,
        name: result.authorName,
        email: result.email,
        jobTitle: null,
        role: "author",
        source: "article",
      },
    ]);
    const contact = await MediaArticleRepository.contactIdByKey(
      article.outletId,
      key,
    );
    if (contact && result.email && !contact.email) {
      await MediaArticleRepository.fillContactEmail(contact.id, result.email);
    }
    await MediaArticleRepository.saveArticleAuthor(article.id, {
      status: "done",
      authorName: result.authorName,
      contactId: contact?.id ?? null,
    });
  }
  return articles.length;
}

async function enrichNext(organizationId?: string) {
  const outlets = await enrichOutlets(organizationId);
  const articles = await enrichArticles(organizationId);
  const pending = organizationId
    ? await MediaScanRepository.pendingCounts(organizationId)
    : null;
  return { outlets, articles, pending };
}

export const MediaEnrichService = { enrichNext };
