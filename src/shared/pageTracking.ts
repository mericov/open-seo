export const TRACKED_PAGE_KINDS = ["blog", "category"] as const;
export type TrackedPageKind = (typeof TRACKED_PAGE_KINDS)[number];

export const TRACKED_PAGE_SOURCES = ["manual", "auto"] as const;

export const PAGE_ALERT_KINDS = [
  "clicks_drop",
  "position_drop",
  "keyword_lost",
  "no_impressions",
  "rising",
] as const;
export type PageAlertKind = (typeof PAGE_ALERT_KINDS)[number];

export const PAGE_CHECK_IDS = [
  "title_length",
  "meta_description",
  "single_h1",
  "article_schema",
  "category_schema",
  "image_alt",
  "word_count",
  "canonical",
  "indexed",
  "faq",
  "question_headings",
  "lists_tables",
  "author",
  "dates",
  "fresh",
  "citations",
] as const;
export type PageCheckId = (typeof PAGE_CHECK_IDS)[number];

export const GEO_CHECK_IDS: readonly PageCheckId[] = [
  "faq",
  "question_headings",
  "lists_tables",
  "author",
  "dates",
  "fresh",
  "citations",
];
