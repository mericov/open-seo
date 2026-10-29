import { AdArchiveService } from "@/server/features/social/services/AdArchiveService";
import { renderBrandKit } from "@/server/features/social/services/BrandKitService";
import type { SocialContext } from "@/server/features/social/services/SocialContextService";

function list(
  lines: string[],
  heading: string,
  rows: string[],
  empty = "None.",
) {
  lines.push(`## ${heading}`, ...(rows.length > 0 ? rows : [empty]), "");
}

export function renderSocialContext(context: SocialContext) {
  const lines: string[] = [
    `# Social & ads context: ${context.project.name}`,
    `Built ${context.builtAt}. Domain ${context.project.domain ?? "?"}, market ${context.project.market}, language ${context.project.languageCode}, timezone ${context.project.timezone}.`,
    "",
  ];
  lines.push(renderBrandKit(context.brand.kit), "");
  lines.push(context.brand.contextMarkdown, "");
  list(
    lines,
    "Saved keywords",
    context.keywords.saved
      .slice(0, 40)
      .map(
        (row) =>
          `- ${row.keyword} (vol ${row.searchVolume ?? "?"}, KD ${row.keywordDifficulty ?? "?"}, ${row.intent ?? "?"})`,
      ),
  );
  list(
    lines,
    "Rank tracker",
    context.keywords.tracked
      .slice(0, 40)
      .map(
        (row) =>
          `- ${row.keyword}: #${row.position ?? "-"} (was ${row.previousPosition ?? "-"}) ${row.url ?? ""}`,
      ),
  );
  const gsc = context.search.searchConsole;
  list(
    lines,
    "Search Console top queries (clicks)",
    gsc?.topQueriesByClicks.map(
      (row) =>
        `- ${row.key}: ${row.clicks} clicks, ${row.impressions} impr, pos ${row.position}`,
    ) ?? [],
  );
  list(
    lines,
    "Search Console top queries (impressions)",
    gsc?.topQueriesByImpressions.map(
      (row) => `- ${row.key}: ${row.impressions} impr, pos ${row.position}`,
    ) ?? [],
  );
  list(
    lines,
    "Search Console rising queries",
    gsc?.risingQueries.map(
      (row) =>
        `- ${row.key}: ${row.previousImpressions} → ${row.impressions} impr`,
    ) ?? [],
  );
  list(
    lines,
    "Search Console top pages",
    gsc?.topPages.map((row) => `- ${row.key}: ${row.clicks} clicks`) ?? [],
  );
  const ga4 = context.search.analytics;
  list(
    lines,
    "GA4 top landing pages",
    ga4?.topLandingPages.map((row) => `- ${JSON.stringify(row)}`) ?? [],
  );
  list(
    lines,
    "GA4 best-selling items",
    ga4?.topItems.map((row) => `- ${JSON.stringify(row)}`) ?? [],
  );
  list(
    lines,
    "Navigation menu",
    context.site.menu.map((row) => `- ${row.title}: ${row.url}`),
  );
  list(
    lines,
    "Collections",
    context.site.collections.map(
      (row) =>
        `- ${row.title}: ${row.url}${row.image ? ` [image ${row.image}]` : ""}`,
    ),
  );
  list(
    lines,
    "Products",
    context.site.products.map(
      (row) =>
        `- ${row.title}${row.price ? ` (${row.price})` : ""}: ${row.url}${row.images[0] ? ` [images ${row.images.join(" ")}]` : ""}`,
    ),
  );
  list(
    lines,
    "Pages",
    context.site.pages.map((row) => `- ${row.title}: ${row.url}`),
  );
  list(
    lines,
    "Store blog articles",
    context.site.articles.map(
      (row) =>
        `- ${row.title}: ${row.url}${row.image ? ` [image ${row.image}]` : ""}`,
    ),
  );
  list(
    lines,
    "MericSEO blog drafts",
    context.content.blogDrafts.map(
      (row) =>
        `- [${row.status}] ${row.title} — ${row.targetKeyword}${row.url ? ` ${row.url}` : ""}`,
    ),
  );
  list(
    lines,
    "Tracked pages",
    context.content.trackedPages.map(
      (row) =>
        `- ${row.title ?? row.url} — ${row.targetKeyword ?? "?"} ${row.url}`,
    ),
  );
  list(
    lines,
    "Previous social posts (do not repeat these ideas, hooks or images)",
    context.content.socialPosts.map(
      (row) =>
        `- [${row.status}] ${row.platform}/${row.format}: ${row.title}${row.hook ? ` | hook: ${row.hook}` : ""}${row.linkUrl ? ` | ${row.linkUrl}` : ""}${row.images.length ? ` | images: ${row.images.join(" ")}` : ""}`,
    ),
  );
  list(
    lines,
    "Competitors",
    context.competitors.map(
      (row) =>
        `- ${row.domain}${row.name ? ` (${row.name})` : ""}${row.notes ? `: ${row.notes}` : ""}`,
    ),
  );
  list(
    lines,
    "AI visibility prompts",
    context.aiVisibility.prompts.map((row) => `- ${row.text}`),
  );
  if (context.aiVisibility.latest)
    lines.push(
      `Latest AI visibility check (${context.aiVisibility.latest.checkedAt}): brand mentioned in ${context.aiVisibility.latest.brandMentioned} of ${context.aiVisibility.latest.answers} answers.`,
      "",
    );
  if (context.ads.competitorReport && context.ads.competitorReport.total > 0)
    lines.push(AdArchiveService.renderReport(context.ads.competitorReport), "");
  else
    lines.push(
      "## Competitor ad archive",
      "Empty. Fill it with save_competitor_ads.",
      "",
    );
  list(
    lines,
    "Our ad drafts (do not repeat their angles)",
    context.ads.ourAds.map(
      (row) =>
        `- [${row.status}] ${row.kind}: ${row.name}${row.angle ? ` | angle: ${row.angle}` : ""} → ${row.landingUrl}`,
    ),
  );
  list(
    lines,
    "Performance of our posts and ads",
    context.performance.map((row) => `- ${row.label}: ${row.value}`),
    "No performance data yet.",
  );
  list(
    lines,
    "Missing data (continue with what is here)",
    context.missing.map((row) => `- ${row}`),
  );
  lines.push(
    "Every link must be one of the site URLs listed above. The save tools verify each URL before storing it.",
  );
  return lines.join("\n");
}
