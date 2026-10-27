import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import { LeadListRepository } from "@/server/features/leads/repositories/LeadListRepository";

const LEGACY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const SLUG_TOKEN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TOKEN_LENGTH = 64;
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const BOT_USER_AGENT =
  /bot|crawl|spider|preview|scan|safelinks|proofpoint|mimecast|barracuda|headless|python|curl|wget/i;
const MAX_REPORT_BYTES = 3_000_000;

const reportKey = (token: string) => `lead-reports/${token}.html`;

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function randomSuffix() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes]
    .map((byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length])
    .join("");
}

async function mintToken(domain: string | null, website: string | null) {
  const host = (
    domain ?? (website ? (URL.parse(website)?.hostname ?? "") : "")
  ).replace(/^www\./, "");
  const brand = slugify(host.split(".")[0] ?? "") || "audit";
  const full = slugify(host) || brand;
  const candidates = [
    brand,
    full,
    ...Array.from({ length: 8 }, (_, i) => `${full}-${i + 2}`),
  ];
  for (const candidate of candidates) {
    if (!(await LeadListRepository.reportTokenExists(candidate))) {
      return candidate;
    }
  }
  return `${full}-${randomSuffix()}`;
}

async function save(projectId: string, leadId: string, html: string) {
  if (new TextEncoder().encode(html).byteLength > MAX_REPORT_BYTES) {
    throw new AppError("VALIDATION_ERROR", "The report is too large to save.");
  }
  const lead = await LeadListRepository.getReportToken(projectId, leadId);
  if (!lead) throw new AppError("NOT_FOUND");
  const legacy =
    lead.reportToken && LEGACY_TOKEN_PATTERN.test(lead.reportToken);
  const token =
    lead.reportToken && !legacy
      ? lead.reportToken
      : await mintToken(lead.domain, lead.website);
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  await env.R2.put(reportKey(token), clean, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });
  await LeadListRepository.setReportToken(projectId, leadId, token);
  if (legacy && lead.reportToken)
    await env.R2.delete(reportKey(lead.reportToken));
  return { token };
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function render(request: Request, token: string): Promise<Response> {
  if (
    token.length > MAX_TOKEN_LENGTH ||
    (!LEGACY_TOKEN_PATTERN.test(token) && !SLUG_TOKEN_PATTERN.test(token))
  ) {
    return notFound();
  }
  if (!(await LeadListRepository.reportTokenExists(token))) return notFound();
  const object = await env.R2.get(reportKey(token));
  if (!object) return notFound();
  const preview = new URL(request.url).searchParams.has("preview");
  const agent = request.headers.get("user-agent") ?? "";
  if (!preview && agent && !BOT_USER_AGENT.test(agent)) {
    await LeadListRepository.recordReportView(token);
  }
  return new Response(await object.text(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "sandbox allow-popups allow-popups-to-escape-sandbox allow-modals; default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "cache-control": "private, max-age=300",
    },
  });
}

export const LeadReportService = { save, render };
