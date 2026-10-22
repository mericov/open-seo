export const PR_MARKETS = ["tr", "us"] as const;
export type PrMarket = (typeof PR_MARKETS)[number];

export const PR_MARKET_TARGETS: Record<
  PrMarket,
  { locationCode: number; languageCode: string }
> = {
  tr: { locationCode: 2792, languageCode: "tr" },
  us: { locationCode: 2840, languageCode: "en" },
};

export const MEDIA_OUTLET_TYPES = [
  "news",
  "blog",
  "magazine",
  "other",
] as const;
export type MediaOutletType = (typeof MEDIA_OUTLET_TYPES)[number];

export const MEDIA_OUTLET_SOURCES = [
  "news",
  "search",
  "gap",
  "manual",
] as const;
export type MediaOutletSource = (typeof MEDIA_OUTLET_SOURCES)[number];

export const MEDIA_ENRICH_STATUSES = ["pending", "done", "failed"] as const;

export const MEDIA_CONTACT_ROLES = ["editor", "author", "general"] as const;
export type MediaContactRole = (typeof MEDIA_CONTACT_ROLES)[number];

export const MEDIA_CONTACT_SOURCES = [
  "masthead",
  "contact_page",
  "article",
  "manual",
] as const;
export type MediaContactSource = (typeof MEDIA_CONTACT_SOURCES)[number];

export const MEDIA_SCAN_TRIGGERS = ["manual", "weekly"] as const;
export type MediaScanTrigger = (typeof MEDIA_SCAN_TRIGGERS)[number];

export const MEDIA_SCAN_STATUSES = ["running", "done", "failed"] as const;

export const PR_TARGET_SOURCES = ["media", "gap"] as const;
export type PrTargetSource = (typeof PR_TARGET_SOURCES)[number];

export const PR_TARGET_STATUSES = [
  "new",
  "drafted",
  "pitched",
  "followup",
  "replied",
  "won",
  "declined",
] as const;
export type PrTargetStatus = (typeof PR_TARGET_STATUSES)[number];

export const PR_LANGUAGES = ["tr", "en"] as const;
export type PrLanguage = (typeof PR_LANGUAGES)[number];

export const MEDIA_SCAN_INTERVAL_DAYS = 7;
export const MEDIA_SCAN_LOCK_MINUTES = 20;
export const PR_FOLLOW_UP_DAYS = 5;
export const PR_CONTACT_COOLDOWN_DAYS = 30;
export const PR_GAP_MAX_COMPETITORS = 5;
export const MEDIA_TOPICS_MAX = 30;

export const PR_TEMPLATE_VARIABLES = [
  "greeting",
  "contact_name",
  "outlet",
  "article_title",
  "pitch",
  "brand",
  "website",
] as const;

export const PR_SAMPLE_TEMPLATES: {
  name: string;
  language: PrLanguage;
  subject: string;
  body: string;
}[] = [
  {
    name: "Haber önerisi (TR)",
    language: "tr",
    subject: "{{outlet}} için bir haber fikri",
    body: [
      "{{greeting}}",
      "",
      "{{pitch}}",
      "",
      "{{brand}} olarak bu konuda görsel, veri ya da uzman görüşü paylaşabiliriz. İlginizi çekerse detayları hemen gönderirim.",
      "",
      "Sevgiler,",
      "Meriç",
      "{{website}}",
      "",
      'Bu tür e-postalar almak istemezseniz "hayır" yazmanız yeterli, bir daha yazmam.',
    ].join("\n"),
  },
  {
    name: "Story idea (EN)",
    language: "en",
    subject: "A story idea for {{outlet}}",
    body: [
      "{{greeting}}",
      "",
      "{{pitch}}",
      "",
      "{{brand}} can share visuals, data or an expert comment on this. Happy to send details if it's useful.",
      "",
      "Best,",
      "Meriç",
      "{{website}}",
      "",
      "If you'd rather not hear from me, just reply \"no\" and I won't email again.",
    ].join("\n"),
  },
];

const FALLBACK_PITCH: Record<PrLanguage, string> = {
  tr: "Son yazılarınızı okuyorum ve okurlarınızın ilgisini çekebilecek bir konu olduğunu düşündüğüm için yazıyorum.",
  en: "I've been reading your recent coverage and thought this might be a fit for your readers.",
};

const GREETING: Record<PrLanguage, (name: string | null) => string> = {
  tr: (name) => (name ? `Merhaba ${name},` : "Merhaba,"),
  en: (name) => (name ? `Hi ${name},` : "Hi there,"),
};

export function prTemplateValues(
  target: {
    contactName: string | null;
    outletName: string | null;
    outletDomain: string;
    articleTitle: string | null;
    pitch: string | null;
  },
  project: { name: string; domain: string | null },
  language: PrLanguage,
): Record<(typeof PR_TEMPLATE_VARIABLES)[number], string> {
  const firstName = target.contactName?.trim().split(/\s+/)[0] || null;
  return {
    greeting: GREETING[language](firstName),
    contact_name: firstName ?? "",
    outlet: target.outletName || target.outletDomain,
    article_title: target.articleTitle ?? "",
    pitch: target.pitch || FALLBACK_PITCH[language],
    brand: project.name,
    website: project.domain ?? "",
  };
}

export function prLanguageForMarket(market: PrMarket): PrLanguage {
  return market === "tr" ? "tr" : "en";
}

export function addDays(iso: string, days: number): string {
  return new Date(
    new Date(iso).getTime() + days * 24 * 60 * 60 * 1000,
  ).toISOString();
}
