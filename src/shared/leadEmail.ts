import { findingBullets, findingPhrase } from "@/shared/leadFindingPhrases";
import type { LeadFindingCode } from "@/shared/leadFindings";

export const LEAD_EMAIL_LANGUAGES = ["tr", "en"] as const;
export type LeadEmailLanguage = (typeof LEAD_EMAIL_LANGUAGES)[number];

export const LEAD_TEMPLATE_VARIABLES = [
  "name",
  "first_line",
  "website",
  "top_gap",
  "top_issues",
  "report_offer",
  "report_link",
] as const;

export const LEAD_REPORT_PATH = "/audit/";

const REPORT_OFFER: Record<
  LeadEmailLanguage,
  { ready: (link: string) => string; later: string }
> = {
  en: {
    ready: (link) =>
      `These are just the top three. The full audit covers many more findings like these, with screenshots, what each one costs you and what changes once it's fixed: ${link}`,
    later:
      "I can send you the full audit this week, with what each issue costs you and what changes once it's fixed. No charge, no call needed.",
  },
  tr: {
    ready: (link) =>
      `Bunlar yalnızca öne çıkan üçü. Raporun tamamında bunlar gibi çok sayıda tespiti; ekran görüntüleriyle, her birinin size neye mal olduğu ve çözülünce ne değişeceğiyle birlikte görebilirsiniz: ${link}`,
    later:
      "İsterseniz raporun tamamını bu hafta gönderebilirim; her sorunun neye mal olduğunu ve çözülünce ne değişeceğini gösteriyor. Ücretsiz, görüşme gerektirmiyor.",
  },
};

export type LeadMailClient = "gmail" | "mailto";

const FALLBACK_FIRST_LINE: Record<LeadEmailLanguage, string> = {
  en: "I took a quick look at your site and noticed a few things that could bring you more customers from Google and AI assistants.",
  tr: "Sitenize kısaca baktım ve size Google'dan ve yapay zeka asistanlarından daha fazla müşteri getirebilecek birkaç şey fark ettim.",
};

export const SAMPLE_TEMPLATES: {
  name: string;
  language: LeadEmailLanguage;
  subject: string;
  body: string;
}[] = [
  {
    name: "Ücretsiz ön denetim (TR)",
    language: "tr",
    subject: "{{website}} için kısa bir ön denetim",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "{{first_line}}",
      "",
      "{{website}} için kısa bir ön denetim yaptım. Öne çıkan üç şey:",
      "{{top_issues}}",
      "",
      "{{report_offer}}",
      "",
      "Takıldığınız bir madde olursa anlatırım; kendiniz uğraşmak istemezseniz sizin için çözebilirim de. 10 yılı aşkın süredir dijital pazarlama ve Shopify üzerine çalışıyorum.",
      "",
      "Sevgiler,",
      "Meriç Özyön",
      "mericozyon.com",
      "",
      "[Şirket adresin]",
      'Bu tür e-postalar almak istemezseniz "hayır" yazmanız yeterli, bir daha yazmam.',
    ].join("\n"),
  },
  {
    name: "Free audit (EN)",
    language: "en",
    subject: "a few things I noticed on {{website}}",
    body: [
      "Hi {{name}} team,",
      "",
      "{{first_line}}",
      "",
      "I ran a quick audit of {{website}}. Three things stood out:",
      "{{top_issues}}",
      "",
      "{{report_offer}}",
      "",
      "Happy to walk you through any of it, or fix it for you if you'd rather hand it off. I've spent 10+ years in marketing and the last six building and growing Shopify stores.",
      "",
      "Best,",
      "Meric Ozyon",
      "mericozyon.com/en",
      "",
      "[Your business address]",
      "If you'd rather not hear from me, just reply \"no\" and I won't email again.",
    ].join("\n"),
  },
];

export function leadEmailLanguage(lead: {
  countryCode: string | null;
  domain: string | null;
  locationLabel: string;
}): LeadEmailLanguage {
  return lead.countryCode === "TR" ||
    Boolean(lead.domain?.endsWith(".tr")) ||
    /türkiye|turkey/i.test(lead.locationLabel)
    ? "tr"
    : "en";
}

export function leadTemplateValues(
  lead: {
    name: string;
    firstLine: string | null;
    website: string | null;
    domain: string | null;
    findings: LeadFindingCode[];
    findingDetails?: Partial<Record<LeadFindingCode, string>>;
  },
  language: LeadEmailLanguage,
  reportUrl: string | null = null,
): Record<(typeof LEAD_TEMPLATE_VARIABLES)[number], string> {
  const topGap = lead.findings[0];
  return {
    report_link: reportUrl ?? "",
    report_offer: reportUrl
      ? REPORT_OFFER[language].ready(reportUrl)
      : REPORT_OFFER[language].later,
    name: lead.name,
    first_line: lead.firstLine ?? FALLBACK_FIRST_LINE[language],
    website: lead.domain ?? lead.website ?? "",
    top_gap: topGap
      ? findingPhrase(topGap, language, lead.findingDetails?.[topGap])
      : "",
    top_issues: findingBullets(
      lead.findings.slice(0, 3),
      language,
      lead.findingDetails,
    ),
  };
}

export function renderTemplate(
  text: string,
  values: Record<string, string>,
): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) =>
    key in values ? (values[key] ?? "") : match,
  );
}

export function composeUrl(
  client: LeadMailClient,
  mail: { to: string; subject: string; body: string },
): string {
  if (client === "gmail") {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: mail.to,
      su: mail.subject,
      body: mail.body,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }
  return `mailto:${mail.to}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
}
