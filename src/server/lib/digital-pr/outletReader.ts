import { Parser } from "htmlparser2";
import { parseRobotsTxt } from "@/server/lib/audit/discovery";
import {
  isCrawlableUrl,
  normalizeAndValidateStartUrl,
} from "@/server/lib/audit/url-policy";
import { jsonLdNodes, nodeTypes } from "@/server/lib/leads/jsonLd";
import { parseHtml, type ParsedPage } from "@/server/lib/leads/pageParser";
import { fetchBody, fetchText } from "@/server/lib/leads/siteFetch";
import { checkEmails } from "@/server/lib/leads/emailChecks";
import {
  cleanPersonName,
  emailMatchesName,
  nameKey,
} from "@/server/lib/digital-pr/personNames";
import type {
  MediaContactRole,
  MediaContactSource,
  MediaOutletType,
} from "@/shared/digitalPr";

const MAX_EXTRA_PAGES = 3;
const MAX_MASTHEAD_NAMES = 8;

const MASTHEAD_LINK =
  /k[üu]nye|impressum|masthead|editorial-team|yay[ıi]n-?kurulu|ekibimiz|our-team|about-us\/team/i;
const CONTACT_LINK =
  /contact|iletisim|iletişim|bize-?ula[sş]|reklam|advertis|write-for-us|yazar-ol/i;

const NEWS_TYPES = [
  "NewsMediaOrganization",
  "NewsArticle",
  "ReportageNewsArticle",
];
const BLOG_TYPES = ["Blog", "BlogPosting"];

const MASTHEAD_ROLES = [
  "Genel Yayın Yönetmeni",
  "Yayın Yönetmeni",
  "Sorumlu Yazı İşleri Müdürü",
  "Yazı İşleri Müdürü",
  "Haber Müdürü",
  "Haber Koordinatörü",
  "Editör",
  "Editor-in-Chief",
  "Editor in Chief",
  "Managing Editor",
  "Executive Editor",
  "Senior Editor",
  "Editor",
];

const NAME_WORD = "[A-ZÇĞİÖŞÜ][a-zçğıöşüA-ZÇĞİÖŞÜ'’.-]+";
const PERSON_NAME = `${NAME_WORD}(?:[ \\t]+${NAME_WORD}){1,3}`;
const ROLE_LINE = new RegExp(
  `(${MASTHEAD_ROLES.map((role) => role.replace(/\s+/g, "\\s+")).join("|")})\\s*[:：\\-–—]\\s*(${PERSON_NAME})`,
  "g",
);

const EDITORIAL_LOCAL_PARTS = new Set([
  "editor",
  "editors",
  "editorial",
  "editoryal",
  "haber",
  "haberler",
  "news",
  "newsroom",
  "yaziisleri",
  "yazi.isleri",
  "press",
  "basin",
  "tips",
]);

type ReadContact = {
  contactKey: string;
  name: string | null;
  email: string | null;
  jobTitle: string | null;
  role: MediaContactRole;
  source: MediaContactSource;
};

type OutletReadResult = {
  status: "done" | "failed";
  name: string | null;
  type: MediaOutletType | null;
  homepageUrl: string | null;
  mastheadUrl: string | null;
  contactPageUrl: string | null;
  contacts: ReadContact[];
};

const FAILED: OutletReadResult = {
  status: "failed",
  name: null,
  type: null,
  homepageUrl: null,
  mastheadUrl: null,
  contactPageUrl: null,
  contacts: [],
};

function pageText(html: string): string {
  const lines: string[] = [];
  let current = "";
  let skip = 0;
  const blocks = new Set([
    "p",
    "div",
    "br",
    "li",
    "tr",
    "td",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "section",
    "article",
    "dd",
    "dt",
  ]);
  const flush = () => {
    const line = current.replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
    current = "";
  };
  const parser = new Parser(
    {
      onopentag(name) {
        if (name === "script" || name === "style" || name === "noscript") {
          skip++;
        }
        if (blocks.has(name)) flush();
      },
      ontext(text) {
        if (skip === 0) current += text;
      },
      onclosetag(name) {
        if (name === "script" || name === "style" || name === "noscript") {
          skip = Math.max(0, skip - 1);
        }
        if (blocks.has(name)) flush();
      },
    },
    { decodeEntities: true },
  );
  parser.write(html.slice(0, 600_000));
  parser.end();
  flush();
  return lines.join("\n");
}

function mastheadPeople(html: string) {
  const people: { name: string; jobTitle: string }[] = [];
  const text = pageText(html);
  for (const match of text.matchAll(ROLE_LINE)) {
    const name = cleanPersonName(match[2] ?? "");
    if (!name) continue;
    if (people.some((person) => person.name === name)) continue;
    people.push({ name, jobTitle: (match[1] ?? "").replace(/\s+/g, " ") });
    if (people.length >= MAX_MASTHEAD_NAMES) break;
  }
  return people;
}

function siteName(html: string, page: ParsedPage): string | null {
  const og =
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,80})["']/i.exec(
      html,
    )?.[1] ??
    /<meta[^>]+content=["']([^"']{2,80})["'][^>]+property=["']og:site_name["']/i.exec(
      html,
    )?.[1];
  if (og) return og.trim();
  const org = jsonLdNodes(html).find((node) =>
    nodeTypes(node).some((type) =>
      ["NewsMediaOrganization", "Organization", "WebSite"].includes(type),
    ),
  );
  if (org && typeof org.name === "string" && org.name.trim()) {
    return org.name.trim().slice(0, 80);
  }
  const title = page.title?.split(/\s[|\-–—]\s/)[0]?.trim();
  return title ? title.slice(0, 80) : null;
}

function outletType(html: string, page: ParsedPage): MediaOutletType | null {
  const types = jsonLdNodes(html).flatMap(nodeTypes);
  if (types.some((type) => NEWS_TYPES.includes(type))) return "news";
  if (/k[üu]nye/i.test(html)) return "news";
  if (types.some((type) => BLOG_TYPES.includes(type))) return "blog";
  if (page.anchors.some((anchor) => /\/blog(\/|$)/i.test(anchor.href))) {
    return "blog";
  }
  return null;
}

function candidatePages(page: ParsedPage, baseUrl: string) {
  const base = new URL(baseUrl);
  const masthead: string[] = [];
  const contact: string[] = [];
  for (const anchor of page.anchors) {
    const label = `${anchor.href} ${anchor.text}`;
    const bucket = MASTHEAD_LINK.test(label)
      ? masthead
      : CONTACT_LINK.test(label)
        ? contact
        : null;
    if (!bucket) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, base);
    } catch {
      continue;
    }
    url.hash = "";
    const href = url.toString();
    if (url.origin !== base.origin || !isCrawlableUrl(href)) continue;
    if (href === base.toString()) continue;
    if (!masthead.includes(href) && !contact.includes(href)) bucket.push(href);
  }
  const turkish = page.lang?.startsWith("tr") ?? base.hostname.endsWith(".tr");
  if (masthead.length === 0 && turkish) {
    masthead.push(new URL("/kunye", base).toString());
  }
  if (contact.length === 0) {
    contact.push(new URL(turkish ? "/iletisim" : "/contact", base).toString());
  }
  return { masthead, contact };
}

function contactRole(
  email: string,
  kind: string,
  fromMasthead: boolean,
): MediaContactRole {
  const local = email.split("@")[0] ?? "";
  if (EDITORIAL_LOCAL_PARTS.has(local)) return "editor";
  if (kind === "personal" && fromMasthead) return "editor";
  return "general";
}

export async function readOutlet(domain: string): Promise<OutletReadResult> {
  let start: string;
  try {
    start = await normalizeAndValidateStartUrl(`https://${domain}/`);
  } catch {
    return FAILED;
  }
  const home = await fetchBody(start, "html");
  if (!home) return FAILED;
  const origin = new URL(home.finalUrl).origin;
  const robotsResponse = await fetchText(`${origin}/robots.txt`);
  const robots = parseRobotsTxt(
    origin,
    robotsResponse && robotsResponse.status === 200
      ? robotsResponse.body
      : null,
  );
  if (!robots.isAllowed(home.finalUrl)) return FAILED;

  const homePage = parseHtml(home.body);
  const { masthead, contact } = candidatePages(homePage, home.finalUrl);
  const emailPages: { emails: Set<string>; masthead: boolean }[] = [
    { emails: homePage.emails, masthead: false },
  ];
  const people: { name: string; jobTitle: string }[] = [];
  let mastheadUrl: string | null = null;
  let contactPageUrl: string | null = null;

  const queue = [
    ...masthead.slice(0, 2).map((url) => ({ url, masthead: true })),
    ...contact.slice(0, 2).map((url) => ({ url, masthead: false })),
  ].slice(0, MAX_EXTRA_PAGES);
  for (const item of queue) {
    if (!robots.isAllowed(item.url)) continue;
    let safeUrl: string;
    try {
      safeUrl = await normalizeAndValidateStartUrl(item.url);
    } catch {
      continue;
    }
    const fetched = await fetchBody(safeUrl, "html");
    if (!fetched) continue;
    const parsed = parseHtml(fetched.body);
    emailPages.push({ emails: parsed.emails, masthead: item.masthead });
    if (item.masthead) {
      mastheadUrl ??= fetched.finalUrl;
      people.push(...mastheadPeople(fetched.body));
    } else if (parsed.emails.size > 0) {
      contactPageUrl ??= fetched.finalUrl;
    }
  }

  const siteDomain = new URL(home.finalUrl).hostname.replace(/^www\./, "");
  const fromMasthead = new Map<string, boolean>();
  for (const page of emailPages) {
    for (const email of page.emails) {
      fromMasthead.set(
        email,
        (fromMasthead.get(email) ?? false) || page.masthead,
      );
    }
  }
  const checked = await checkEmails([...fromMasthead.keys()], siteDomain);
  const usable = checked.filter(
    (check) =>
      check.checkStatus === "mx_ok" &&
      (check.onOwnDomain || check.kind === "free_provider"),
  );

  const contacts: ReadContact[] = [];
  const namedEmails = new Set<string>();
  for (const person of people.slice(0, MAX_MASTHEAD_NAMES)) {
    const email =
      usable.find(
        (check) =>
          check.kind === "personal" &&
          emailMatchesName(check.email, person.name),
      )?.email ?? null;
    if (email) namedEmails.add(email);
    contacts.push({
      contactKey: email ? `email:${email}` : nameKey(person.name),
      name: person.name,
      email,
      jobTitle: person.jobTitle,
      role: "editor",
      source: "masthead",
    });
  }
  for (const check of usable) {
    if (namedEmails.has(check.email)) continue;
    const isMasthead = fromMasthead.get(check.email) ?? false;
    contacts.push({
      contactKey: `email:${check.email}`,
      name: null,
      email: check.email,
      jobTitle: null,
      role: contactRole(check.email, check.kind, isMasthead),
      source: isMasthead ? "masthead" : "contact_page",
    });
  }

  return {
    status: "done",
    name: siteName(home.body, homePage),
    type: outletType(home.body, homePage),
    homepageUrl: `${origin}/`,
    mastheadUrl,
    contactPageUrl,
    contacts,
  };
}
