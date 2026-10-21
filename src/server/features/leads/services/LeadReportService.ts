import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import { LeadListRepository } from "@/server/features/leads/repositories/LeadListRepository";

const LEAD_REPORT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const MAX_REPORT_BYTES = 3_000_000;

const reportKey = (token: string) => `lead-reports/${token}.html`;

function mintToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function save(projectId: string, leadId: string, html: string) {
  if (new TextEncoder().encode(html).byteLength > MAX_REPORT_BYTES) {
    throw new AppError("VALIDATION_ERROR", "The report is too large to save.");
  }
  const lead = await LeadListRepository.getReportToken(projectId, leadId);
  if (!lead) throw new AppError("NOT_FOUND");
  const token = lead.reportToken ?? mintToken();
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  await env.R2.put(reportKey(token), clean, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });
  await LeadListRepository.setReportToken(projectId, leadId, token);
  return { token };
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function render(token: string): Promise<Response> {
  if (!LEAD_REPORT_TOKEN_PATTERN.test(token)) return notFound();
  if (!(await LeadListRepository.reportTokenExists(token))) return notFound();
  const object = await env.R2.get(reportKey(token));
  if (!object) return notFound();
  return new Response(await object.text(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "sandbox allow-popups allow-modals; default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "cache-control": "private, max-age=300",
    },
  });
}

export const LeadReportService = { save, render };
