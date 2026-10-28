import en from "@/locales/en/leads.json";
import tr from "@/locales/tr/leads.json";
import type { LeadEmailLanguage } from "@/shared/leadEmail";
import {
  LEAD_FINDING_CATEGORIES,
  LEAD_FINDING_META,
  LEAD_FINDING_SEVERITIES,
  type LeadFindingCode,
  type LeadFindingSeverity,
} from "@/shared/leadFindings";

const TEXTS = { en, tr };

const SEVERITY_COLORS: Record<LeadFindingSeverity, string> = {
  critical: "#dc2626",
  important: "#d97706",
  low: "#64748b",
};

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

export function leadReportHtml(input: {
  name: string;
  website: string | null;
  language: LeadEmailLanguage;
  score: number | null;
  findings: LeadFindingCode[];
  findingDetails: Partial<Record<LeadFindingCode, string>>;
}) {
  const text = TEXTS[input.language];
  const copy = text.serverReport;
  const host = input.website
    ? (URL.parse(input.website)?.hostname.replace(/^www\./, "") ??
      input.website)
    : null;
  const date = new Date().toLocaleDateString(
    input.language === "tr" ? "tr-TR" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );
  const health = Math.max(0, 100 - (input.score ?? 0));
  const healthColor =
    health >= 70 ? "#16a34a" : health >= 40 ? "#d97706" : "#dc2626";
  const counts = LEAD_FINDING_SEVERITIES.map((severity) => ({
    severity,
    total: input.findings.filter(
      (code) => LEAD_FINDING_META[code][1] === severity,
    ).length,
  }));

  const detailOf = (code: LeadFindingCode) => {
    const value = input.findingDetails[code];
    if (!value) return "";
    const formats: Partial<Record<string, string>> = text.findingDetail;
    const format = formats[code];
    return format ? fill(format, { value }) : value;
  };

  const sections = LEAD_FINDING_CATEGORIES.map((category) => {
    const items = input.findings.filter(
      (code) => LEAD_FINDING_META[code][0] === category,
    );
    if (items.length === 0) return "";
    const rows = items
      .map((code) => {
        const severity = LEAD_FINDING_META[code][1];
        const detail = detailOf(code);
        return `<li class="item">
  <div class="item-head">
    <span class="badge" style="background:${SEVERITY_COLORS[severity]}">${escape(text.findingSeverity[severity])}</span>
    <strong>${escape(text.findings[code])}</strong>${detail ? `<span class="detail">${escape(detail)}</span>` : ""}
  </div>
  <p><span class="why">${escape(copy.why)}</span> ${escape(text.findingWhy[code])}</p>
</li>`;
      })
      .join("\n");
    return `<section>
  <h2>${escape(text.findingCategories[category])} <span class="count">${items.length}</span></h2>
  <ul>${rows}</ul>
</section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="${input.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(fill(copy.title, { name: input.name }))}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 16px 64px}
header{background:#0f172a;color:#fff;border-radius:16px;padding:32px 28px}
header h1{margin:0 0 6px;font-size:28px;line-height:1.2}
header p{margin:0;color:#cbd5e1}
.summary{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0 8px}
.card{flex:1 1 140px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
.card b{display:block;font-size:28px;line-height:1.1}
.card span{color:#64748b;font-size:14px}
.intro{margin:20px 0}
section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 22px;margin:16px 0}
h2{margin:0 0 8px;font-size:19px}
.count{color:#64748b;font-weight:400;font-size:15px}
ul{list-style:none;margin:0;padding:0}
.item{padding:12px 0;border-top:1px solid #f1f5f9}
.item:first-child{border-top:0}
.item-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.item p{margin:6px 0 0;color:#334155;font-size:15px}
.badge{color:#fff;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:600}
.detail{color:#64748b;font-size:14px}
.why{font-weight:600}
footer{margin-top:28px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:22px;text-align:center}
footer p{margin:0 0 6px}
</style>
</head>
<body>
<main>
<header>
  <h1>${escape(fill(copy.title, { name: input.name }))}</h1>
  <p>${host ? `${escape(host)} · ` : ""}${escape(date)}</p>
</header>
<div class="summary">
  <div class="card"><b style="color:${healthColor}">${health}/100</b><span>${escape(copy.health)}</span></div>
  ${counts
    .map(
      ({ severity, total }) =>
        `<div class="card"><b style="color:${SEVERITY_COLORS[severity]}">${total}</b><span>${escape(text.findingSeverity[severity])}</span></div>`,
    )
    .join("\n  ")}
</div>
<p class="intro">${escape(input.findings.length ? fill(copy.intro, { count: input.findings.length }) : copy.noIssues)}</p>
${sections}
<footer>
  <p><strong>${escape(copy.ctaTitle)}</strong></p>
  <p>${escape(copy.ctaBody)}</p>
</footer>
</main>
</body>
</html>`;
}
