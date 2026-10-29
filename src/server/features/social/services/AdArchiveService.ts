import { sortBy } from "remeda";
import {
  AdArchiveRepository,
  type CompetitorAd,
} from "@/server/features/social/repositories/AdArchiveRepository";
import { WINNER_MIN_DAYS } from "@/shared/social";
import type { z } from "zod";
import type {
  adPageInputSchema,
  competitorAdInputSchema,
} from "@/types/schemas/social";

const DAY_MS = 86_400_000;
const ARCHIVE_LIMIT = 1000;

function daysRunning(ad: CompetitorAd, now = Date.now()) {
  if (!ad.startedAt) return null;
  const end = ad.stoppedAt ? Date.parse(ad.stoppedAt) : now;
  return Math.max(0, Math.floor((end - Date.parse(ad.startedAt)) / DAY_MS));
}

function toView(ad: CompetitorAd) {
  const days = daysRunning(ad);
  return {
    ...ad,
    daysRunning: days,
    winner: days !== null && days >= WINNER_MIN_DAYS,
  };
}

type CompetitorAdView = ReturnType<typeof toView>;

async function listPages(projectId: string) {
  return AdArchiveRepository.listPages(projectId);
}

async function addPages(
  projectId: string,
  pages: z.infer<typeof adPageInputSchema>[],
) {
  for (const page of pages) {
    await AdArchiveRepository.upsertPage(projectId, {
      pageId: page.pageId,
      pageName: page.pageName,
      domain: page.domain ?? null,
      kind: page.kind,
    });
  }
  return listPages(projectId);
}

async function removePage(projectId: string, pageId: string) {
  await AdArchiveRepository.removePages(projectId, [pageId]);
  return listPages(projectId);
}

async function saveAds(
  projectId: string,
  ads: z.infer<typeof competitorAdInputSchema>[],
) {
  const now = new Date().toISOString();
  for (const ad of ads) {
    await AdArchiveRepository.upsertAd(projectId, {
      libraryId: ad.libraryId,
      pageId: ad.pageId,
      pageName: ad.pageName,
      country: ad.country ?? null,
      snapshotUrl: ad.snapshotUrl,
      headline: ad.headline ?? null,
      body: ad.body ?? null,
      description: ad.description ?? null,
      cta: ad.cta ?? null,
      format: ad.format,
      hook: ad.hook ?? null,
      angle: ad.angle ?? null,
      offer: ad.offer ?? null,
      mediaUrl: ad.mediaUrl ?? null,
      transcript: ad.transcript ?? null,
      sceneSummary: ad.sceneSummary ?? null,
      startedAt: ad.startedAt ?? null,
      stoppedAt: ad.stoppedAt ?? null,
      lastSeenAt: now,
      active: ad.active,
    });
  }
  return { saved: ads.length };
}

async function listAds(projectId: string) {
  const ads = await AdArchiveRepository.listAds(projectId, ARCHIVE_LIMIT);
  return ads.map(toView);
}

async function removeAd(projectId: string, id: string) {
  await AdArchiveRepository.removeAd(projectId, id);
  return { ok: true as const };
}

function tally(
  ads: CompetitorAdView[],
  pick: (ad: CompetitorAdView) => string | null,
) {
  const counts = new Map<
    string,
    { value: string; ads: number; winners: number }
  >();
  for (const ad of ads) {
    const raw = pick(ad)?.trim();
    if (!raw) continue;
    const key = raw.toLocaleLowerCase();
    const row = counts.get(key) ?? { value: raw, ads: 0, winners: 0 };
    row.ads += 1;
    if (ad.winner) row.winners += 1;
    counts.set(key, row);
  }
  return sortBy(
    [...counts.values()],
    [(row) => row.winners, "desc"],
    [(row) => row.ads, "desc"],
  ).slice(0, 15);
}

async function report(projectId: string) {
  const ads = await listAds(projectId);
  const winners = sortBy(
    ads.filter((ad) => ad.winner),
    [(ad) => ad.daysRunning ?? 0, "desc"],
  );
  return {
    total: ads.length,
    active: ads.filter((ad) => ad.active).length,
    winners: winners.length,
    untagged: ads.filter((ad) => !ad.angle && !ad.hook).length,
    formats: tally(ads, (ad) => ad.format),
    angles: tally(ads, (ad) => ad.angle),
    hooks: tally(ads, (ad) => ad.hook),
    offers: tally(ads, (ad) => ad.offer),
    ctas: tally(ads, (ad) => ad.cta),
    advertisers: tally(ads, (ad) => ad.pageName),
    topWinners: winners.slice(0, 12),
  };
}

type AdReport = Awaited<ReturnType<typeof report>>;

function reportRows(title: string, list: AdReport["angles"]) {
  return;
  [
    `## ${title}`,
    ...(list.length > 0
      ? list.map(
          (row) => `- ${row.value}: ${row.ads} ads, ${row.winners} winners`,
        )
      : ["Not tagged yet."]),
    "",
  ].join("\n");
}

function renderReport(data: AdReport) {
  return [
    `# What works in this category (${data.total} ads, ${data.active} active, ${data.winners} running ${WINNER_MIN_DAYS}+ days)`,
    `Winner signal = an ad that has run ${WINNER_MIN_DAYS}+ days: advertisers keep paying for what converts. ${data.untagged} ads still need hook/angle tags.`,
    "",
    reportRows("Angles", data.angles),
    reportRows("Hooks", data.hooks),
    reportRows("Offers", data.offers),
    reportRows("Formats", data.formats),
    reportRows("CTAs", data.ctas),
    reportRows("Advertisers", data.advertisers),
    "## Longest-running ads",
    ...(data.topWinners.length > 0
      ? data.topWinners.map(
          (ad) =>
            `- ${ad.pageName}, ${ad.daysRunning} days, ${ad.format}: ${ad.hook ?? ad.headline ?? "?"}${ad.angle ? ` | angle: ${ad.angle}` : ""}${ad.offer ? ` | offer: ${ad.offer}` : ""} ${ad.snapshotUrl}`,
        )
      : ["None yet."]),
  ].join("\n");
}

export const AdArchiveService = {
  listPages,
  addPages,
  removePage,
  saveAds,
  listAds,
  removeAd,
  report,
  renderReport,
};
