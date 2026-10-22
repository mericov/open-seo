import type { ParsedPage } from "@/server/lib/leads/pageParser";
import type { LeadFinding } from "@/shared/leadFindings";

const MODERN_ANALYTICS =
  /googletagmanager\.com\/(gtag\/js|gtm\.js)|["'\\]G-[A-Z0-9]{6,}(?=["'\\])|["'\\]GTM-[A-Z0-9]{4,}(?=["'\\])|google_tag_ids/i;
const LEGACY_ANALYTICS =
  /["'\\]UA-\d{4,}-\d+(?=["'\\])|google-analytics\.com\/(analytics|ga)\.js|urchin\.js/i;
const META_PIXEL =
  /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*["']init|facebook-pixel|pixel_?id\\?"\s*:\s*\\?"\d{6,}/i;
const GOOGLE_ADS = /["'\\]AW-\d{6,}|googleadservices\.com\/pagead\/conversion/i;
const TIKTOK_PIXEL =
  /analytics\.tiktok\.com|ttq\.(load|page)|tiktok[-_ ]?pixel/i;
const PINTEREST_TAG =
  /s\.pinimg\.com\/ct\/core\.js|pintrk\(|ct\.pinterest\.com|pinterest[-_ ]?tag/i;
const HEATMAP =
  /clarity\.ms|hotjar|luckyorange|mouseflow|fullstory|smartlook|crazyegg|contentsquare/i;
const CONSENT =
  /cookiebot|onetrust|cookielaw\.org|cookieyes|iubenda|usercentrics|termly|complianz|cookie-law-info|cookie-notice|osano|didomi|consentmanager|klaro|privacy-banner|trackingconsent|cookie-?consent|cookie-?banner|gdpr/i;
const CONSENT_MANAGER =
  /cookiebot|onetrust|cookielaw\.org|cookieyes|iubenda|usercentrics|termly|complianz|osano|didomi|consentmanager|klaro|shopify-pc__banner|pandectes|consentmo|axeptio|sirdata|quantcast|trustarc/i;
const EMAIL_TOOLS =
  /klaviyo|omnisend|widget\.privy\.com|privy\.com|sendinblue|brevo|mailerlite|getdrip|attn\.tv|attentivemobile|convertkit|activecampaign|hsforms|hs-scripts|mailjet|getresponse|constantcontact|ctctcdn|shopify-forms|forms\.shopifyapps|seguno|postscript|justuno|wisepops|optimonk|smsbump|sendlane|emarsys|bluecore|listrak|dotdigital|cordial\.io|iterable|moosend|flodesk|aweber|beehiiv|tinyalbert|shopify-email|retention\.com/i;
const EMAIL_FORM =
  /name\s*=\s*["']contact\[email\]["']|<form\b[^>]*(?:newsletter|subscribe)[^>]*>|class\s*=\s*["'][^"']*newsletter/i;
const MAILCHIMP = /chimpstatic\.com|list-manage\.com|mailchimp/i;
const REVIEW_APPS =
  /judge\.me|judgeme|yotpo|loox|okendo|stamped\.io|reviews\.io|trustpilot|junip|rivyo|air-reviews|growave|opinew|ali-reviews|spr-badge|shopify-product-reviews|feefo|trustindex|kudobuzz|woocommerce-product-rating|star-rating/i;
const LIVE_CHAT =
  /tidio|gorgias|zendesk|zopim|intercom|crisp\.chat|tawk\.to|livechatinc|drift\.com|hs-scripts|shopify-chat|inbox\.shopify|smartsupp|jivosite|jivochat|freshchat|olark|userlike|chatra|wa\.me\/|api\.whatsapp\.com|whatsapp|m\.me\//i;
const BOOKING =
  /calendly|booksy|fresha|treatwell|acuityscheduling|setmore|simplybook|vagaro|mindbody|squareup\.com\/appointments|square\.site|zocdoc|doctolib|doktortakvimi|opentable|resy\.com|sevenrooms|thefork|exploretock|youcanbook|glossgenius|schedulicity|timely|phorest|salonized|planity|randevu|appointment|book now|book online|book an appointment|reserv/i;
const SHOPIFY_THEME = /Shopify\.theme\s*=\s*(\{[^;]*?\})\s*;/;
const POWERED_BY_SHOPIFY = /powered by shopify|utm_campaign=poweredby/i;
const WORDPRESS_STOCK_THEME =
  /wp-content\/themes\/(twenty[a-z]+|storefront)\//i;

const FREE_SHOPIFY_THEMES = new Set([
  "dawn",
  "refresh",
  "sense",
  "craft",
  "crave",
  "studio",
  "taste",
  "ride",
  "colorblock",
  "origin",
  "spotlight",
  "publisher",
  "trade",
  "horizon",
  "atelier",
  "dwell",
  "fabric",
  "heritage",
  "pitch",
  "ritual",
  "savor",
  "tinker",
  "vessel",
]);
const VINTAGE_SHOPIFY_THEMES = new Set([
  "debut",
  "brooklyn",
  "simple",
  "narrative",
  "supply",
  "venture",
  "minimal",
  "boundless",
  "express",
  "jumpstart",
  "pop",
]);
const BOOKING_GROUPS = new Set(["health", "beauty", "fitness"]);

export type SitePlatform = "shopify" | "woocommerce" | null;

export function detectPlatform(html: string): SitePlatform {
  if (/cdn\.shopify\.com|Shopify\.theme|myshopify\.com/.test(html)) {
    return "shopify";
  }
  if (/wp-content\/plugins\/woocommerce|woocommerce-/i.test(html)) {
    return "woocommerce";
  }
  return null;
}

function shopifyThemeName(html: string): string | null {
  const match = SHOPIFY_THEME.exec(html);
  if (!match) return null;
  try {
    const theme = JSON.parse(match[1]) as {
      name?: unknown;
      schema_name?: unknown;
    };
    const name =
      typeof theme.schema_name === "string" ? theme.schema_name : theme.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

export function detectMarketingFindings(input: {
  html: string;
  extraHtml: string;
  finalUrl: string;
  page: ParsedPage;
  platform: SitePlatform;
  store: boolean;
  categoryGroup: string | null;
  market: { eu: boolean; tr: boolean };
}): LeadFinding[] {
  const { html, page } = input;
  const all = `${html}\n${input.extraHtml}`;
  const findings: LeadFinding[] = [];
  const add = (code: LeadFinding["code"], detail?: string | null) =>
    findings.push({ code, detail: detail ?? null });

  const gated = CONSENT_MANAGER.test(html);
  if (LEGACY_ANALYTICS.test(html) && !MODERN_ANALYTICS.test(html)) {
    add("legacy_analytics");
  } else if (!gated && !MODERN_ANALYTICS.test(html)) add("no_analytics");
  if (!gated) {
    if (!META_PIXEL.test(html)) add("no_meta_pixel");
    if (!GOOGLE_ADS.test(html)) add("no_google_ads_tag");
    if (input.store && !TIKTOK_PIXEL.test(html)) add("no_tiktok_pixel");
    if (input.store && !PINTEREST_TAG.test(html)) add("no_pinterest_tag");
    if (!HEATMAP.test(html)) add("no_heatmap");
  }
  if (input.market.eu && !CONSENT.test(html)) add("no_consent_banner");

  if (input.store) {
    if (!EMAIL_TOOLS.test(html)) {
      if (MAILCHIMP.test(html)) add("mailchimp_store");
      else if (!EMAIL_FORM.test(html)) add("no_email_marketing");
    }
    if (!REVIEW_APPS.test(all)) add("no_reviews_app");
  }
  if (!LIVE_CHAT.test(html)) add("no_live_chat");

  if (!input.store) {
    if (!page.anchors.some((anchor) => /^tel:/i.test(anchor.href))) {
      add("no_click_to_call");
    }
    if (
      input.categoryGroup &&
      BOOKING_GROUPS.has(input.categoryGroup) &&
      !BOOKING.test(html)
    ) {
      add("no_online_booking");
    }
  }

  if (input.platform === "shopify") {
    if (new URL(input.finalUrl).hostname.endsWith(".myshopify.com")) {
      add("myshopify_domain");
    }
    const theme = shopifyThemeName(html);
    const key = theme?.toLowerCase().split(/\s/)[0] ?? "";
    if (VINTAGE_SHOPIFY_THEMES.has(key)) add("vintage_theme", theme);
    else if (FREE_SHOPIFY_THEMES.has(key)) add("stock_theme", theme);
    if (POWERED_BY_SHOPIFY.test(html)) add("powered_by_shopify");
  } else {
    const wpTheme = WORDPRESS_STOCK_THEME.exec(html)?.[1];
    if (wpTheme) add("stock_theme", wpTheme);
  }
  return findings;
}
