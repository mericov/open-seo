import { Parser } from "htmlparser2";

const EMAIL_PATTERN = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}/gi;
const OBFUSCATED_EMAIL_PATTERN =
  /([a-z0-9._%+-]{1,64})\s*[[(]\s*(?:at|@)\s*[\])]\s*([a-z0-9-]{1,63}(?:\s*[[(]\s*(?:dot|\.)\s*[\])]\s*[a-z0-9-]{1,63})+)/gi;

const JUNK_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "domain.com",
  "yourdomain.com",
  "email.com",
  "mysite.com",
  "company.com",
  "test.com",
  "sentry.io",
  "wixpress.com",
  "sentry.wixpress.com",
  "sentry-next.wixpress.com",
]);
const JUNK_LOCAL_PARTS = new Set([
  "your",
  "yourname",
  "name",
  "email",
  "user",
  "username",
  "example",
  "test",
  "johndoe",
  "john.doe",
  "noreply",
  "no-reply",
  "donotreply",
]);
const ASSET_EXTENSION = /\.(png|jpe?g|gif|svg|webp|avif|css|js|ico)$/i;
const HIDDEN_TEXT_TAGS = new Set(["script", "style", "noscript", "template"]);
const OVERLAY_CLASS =
  /\b[\w-]*(modal|drawer|quick-add|predictive-search|popup)[\w-]*\b/i;

export type ParsedPage = {
  lang: string | null;
  anchors: { href: string; text: string }[];
  emails: Set<string>;
  title: string | null;
  h1Count: number;
  images: number;
  imagesWithoutAlt: number;
  lazyImages: number;
  responsiveImages: number;
  hasCanonical: boolean;
  hasOpenGraph: boolean;
  hasFavicon: boolean;
  noindex: boolean;
  hreflangCount: number;
  scriptHosts: Set<string>;
  wordCount: number;
};

export function parseHtml(html: string): ParsedPage {
  const page: ParsedPage = {
    lang: null,
    anchors: [],
    emails: new Set(),
    title: null,
    h1Count: 0,
    images: 0,
    imagesWithoutAlt: 0,
    lazyImages: 0,
    responsiveImages: 0,
    hasCanonical: false,
    hasOpenGraph: false,
    hasFavicon: false,
    noindex: false,
    hreflangCount: 0,
    scriptHosts: new Set(),
    wordCount: 0,
  };
  let openAnchor: { href: string; text: string } | null = null;
  let titleText: string | null = null;
  let hiddenDepth = 0;
  let svgDepth = 0;
  const overlayStack: boolean[] = [];
  let overlayDepth = 0;
  const textChunks: string[] = [];
  const visibleChunks: string[] = [];

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (HIDDEN_TEXT_TAGS.has(name)) hiddenDepth++;
        if (name === "svg") svgDepth++;
        if (name === "html" && attrs.lang) page.lang = attrs.lang.toLowerCase();
        if (name === "title" && page.title === null && svgDepth === 0) {
          titleText = "";
        }
        const overlay =
          name === "dialog" ||
          "hidden" in attrs ||
          attrs["aria-hidden"] === "true" ||
          OVERLAY_CLASS.test(`${name} ${attrs.class ?? ""}`);
        overlayStack.push(overlay);
        if (overlay) overlayDepth++;
        if (name === "h1" && hiddenDepth === 0 && overlayDepth === 0) {
          page.h1Count++;
        }
        if (name === "img") readImage(page, attrs);
        if (name === "meta") readMeta(page, attrs);
        if (name === "link") readLink(page, attrs);
        if (name === "script" && attrs.src) {
          const host = URL.parse(attrs.src, "https://x.invalid")?.host;
          if (host) page.scriptHosts.add(host);
        }
        if (attrs["data-cfemail"]) {
          addEmail(page.emails, decodeCloudflareEmail(attrs["data-cfemail"]));
        }
        if (name === "a" && attrs.href) {
          const href = attrs.href.trim();
          if (href.toLowerCase().startsWith("mailto:")) {
            addEmail(page.emails, mailtoAddress(href));
          }
          openAnchor = { href, text: "" };
        }
      },
      ontext(text) {
        textChunks.push(text);
        if (titleText !== null) titleText += text;
        if (hiddenDepth === 0) visibleChunks.push(text);
        if (openAnchor) openAnchor.text += text;
      },
      onclosetag(name) {
        if (overlayStack.pop()) overlayDepth--;
        if (HIDDEN_TEXT_TAGS.has(name) && hiddenDepth > 0) hiddenDepth--;
        if (name === "svg" && svgDepth > 0) svgDepth--;
        if (name === "title" && titleText !== null) {
          page.title = titleText.replace(/\s+/g, " ").trim();
          titleText = null;
        }
        if (name === "a" && openAnchor) {
          page.anchors.push(openAnchor);
          openAnchor = null;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();

  page.scriptHosts.delete("x.invalid");
  page.wordCount = visibleChunks
    .join(" ")
    .split(/\s+/)
    .filter((word) => /\p{L}{2,}/u.test(word)).length;

  const text = textChunks.join(" ");
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    addEmail(page.emails, match[0]);
  }
  for (const match of text.matchAll(OBFUSCATED_EMAIL_PATTERN)) {
    const domain = match[2].replace(/\s*[[(]\s*(?:dot|\.)\s*[\])]\s*/gi, ".");
    addEmail(page.emails, `${match[1]}@${domain}`);
  }
  return page;
}

function readImage(page: ParsedPage, attrs: Record<string, string>) {
  page.images++;
  if (!attrs.alt?.trim()) page.imagesWithoutAlt++;
  if (attrs.loading === "lazy" || attrs["data-src"]) page.lazyImages++;
  if (attrs.srcset || attrs["data-srcset"]) page.responsiveImages++;
}

function readMeta(page: ParsedPage, attrs: Record<string, string>) {
  const name = (attrs.name ?? "").toLowerCase();
  const property = (attrs.property ?? "").toLowerCase();
  if (
    (name === "robots" || name === "googlebot") &&
    /noindex/i.test(attrs.content ?? "")
  ) {
    page.noindex = true;
  }
  if (property === "og:title" || property === "og:image") {
    page.hasOpenGraph = true;
  }
}

function readLink(page: ParsedPage, attrs: Record<string, string>) {
  const rel = (attrs.rel ?? "").toLowerCase();
  if (rel.split(/\s+/).includes("canonical")) page.hasCanonical = true;
  if (/\bicon\b/.test(rel)) page.hasFavicon = true;
  if (rel.includes("alternate") && attrs.hreflang) page.hreflangCount++;
}

function addEmail(set: Set<string>, raw: string | null) {
  if (!raw) return;
  const email = raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[.]+$/g, "");
  if (isPlausibleEmail(email)) set.add(email);
}

function isPlausibleEmail(email: string): boolean {
  const [local, domain] = email.split("@");
  if (!local || !domain || email.split("@").length !== 2) return false;
  if (
    !/^[a-z0-9._%+-]+$/.test(local) ||
    !/^[a-z0-9.-]+\.[a-z]{2,24}$/.test(domain)
  ) {
    return false;
  }
  if (ASSET_EXTENSION.test(email)) return false;
  if (JUNK_EMAIL_DOMAINS.has(domain) || JUNK_LOCAL_PARTS.has(local))
    return false;
  // Hash-like local parts are tracking ids (e.g. Sentry DSNs), not inboxes.
  if (/^[a-f0-9]{20,}$/.test(local)) return false;
  return true;
}

function mailtoAddress(href: string): string | null {
  try {
    const value = decodeURIComponent(href.slice("mailto:".length));
    return value.split("?")[0].split(",")[0];
  } catch {
    return null;
  }
}

function decodeCloudflareEmail(encoded: string): string | null {
  if (!/^[0-9a-f]+$/i.test(encoded) || encoded.length < 4) return null;
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < encoded.length; i += 2) {
    out += String.fromCharCode(
      Number.parseInt(encoded.slice(i, i + 2), 16) ^ key,
    );
  }
  return out;
}
