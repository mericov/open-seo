import { findingBullets, findingPhrase } from "@/shared/leadFindingPhrases";
import type { LeadFindingCode } from "@/shared/leadFindings";
import type { LeadMailStep } from "@/shared/leadFollowUp";

export const LEAD_EMAIL_LANGUAGES = ["tr", "en"] as const;
export type LeadEmailLanguage = (typeof LEAD_EMAIL_LANGUAGES)[number];

export const LEAD_TEMPLATE_VARIABLES = [
  "name",
  "first_line",
  "website",
  "top_gap",
  "top_issues",
  "more_issues",
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
      `These are just the top three. The full audit covers many more findings like these, with screenshots, what each one costs you and what changes once it's fixed:\n${link}`,
    later:
      "I can send you the full audit this week, with what each issue costs you and what changes once it's fixed. No charge, no call needed.",
  },
  tr: {
    ready: (link) =>
      `Bunlar yalnızca öne çıkan üçü. Raporun tamamında bunlar gibi çok sayıda tespiti; ekran görüntüleriyle, her birinin size neye mal olduğu ve çözülünce ne değişeceğiyle birlikte görebilirsiniz:\n${link}`,
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
  step: LeadMailStep;
  subject: string;
  body: string;
}[] = [
  {
    name: "Ücretsiz ön denetim (TR)",
    language: "tr",
    step: 1,
    subject: "{{website}} için kısa bir ön denetim",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "Sitenizi inceledim ve daha fazla müşteri getirebilecek, dönüşüm oranlarınızı artırabilecek geliştirmeler fark ettim.",
      "",
      "Ön denetimde öne çıkan üç başlık:",
      "{{top_issues}}",
      "",
      "Hazırladığım raporda bunlar gibi çok sayıda tespiti, ekran görüntüleriyle bulabilirsiniz.",
      "",
      "{{report_link}}",
      "",
      "Sormak istediğiniz bir şey olursa bu e-postayı yanıtlamanız yeterli.",
      "",
      "Güzel günler,",
      "Meriç Özyön",
      "mericozyon.com",
      "",
      'Bu tür e-postalar almak istemezseniz "hayır" yazmanız yeterli, bir daha yazmam.',
    ].join("\n"),
  },
  {
    name: "Takip 1 (TR)",
    language: "tr",
    step: 2,
    subject: "Re: {{website}} için kısa bir ön denetim",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "Geçen hafta {{website}} için hazırladığım ön denetim raporunu iletmiştim; gözünüzden kaçmış olabilir diye kısaca hatırlatmak istedim.",
      "",
      "Raporda öne çıkan konulardan biri: {{top_gap}}.",
      "",
      "Raporun tamamına buradan ulaşabilirsiniz:",
      "{{report_link}}",
      "",
      "Sormak istediğiniz bir şey olursa bu e-postayı yanıtlamanız yeterli.",
      "",
      "Güzel günler,",
      "Meriç Özyön",
      "mericozyon.com",
      "",
      'Bu tür e-postalar almak istemezseniz "hayır" yazmanız yeterli, bir daha yazmam.',
    ].join("\n"),
  },
  {
    name: "Takip 2 (TR)",
    language: "tr",
    step: 3,
    subject: "Re: {{website}} için kısa bir ön denetim",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "Sizi daha fazla meşgul etmemek için bu son e-postam. Bu konular şu an önceliğiniz değilse hiç sorun değil.",
      "",
      "İleride dönüşüm oranınızı ve satışlarınızı artırmak için destek isterseniz rapor burada duruyor:",
      "{{report_link}}",
      "",
      "Bu e-postayı yanıtlamanız yeterli; uygun bir zamanda kısa bir görüşme de ayarlayabiliriz.",
      "",
      "Güzel günler,",
      "Meriç Özyön",
      "mericozyon.com",
      "",
      'Bu tür e-postalar almak istemezseniz "hayır" yazmanız yeterli, bir daha yazmam.',
    ].join("\n"),
  },
  {
    name: "Free audit (EN)",
    language: "en",
    step: 1,
    subject: "Quick audit of {{website}}",
    body: [
      "Hi {{name}} team,",
      "",
      "I took a look at your site and spotted a few improvements that could bring in more customers and lift your conversion rate.",
      "",
      "Three things stood out in my audit:",
      "{{top_issues}}",
      "",
      "I put together a report with many more findings like these, complete with screenshots:",
      "",
      "{{report_link}}",
      "",
      "If you have any questions, just reply to this email.",
      "",
      "Best,",
      "Meric Ozyon",
      "mericozyon.com/en",
      "",
      "Nine Nine LLC · 110 N Interstate 35, Suite 315-834, Round Rock, TX 78681",
      'If you\'d rather not get emails like this, just reply "no."',
    ].join("\n"),
  },
  {
    name: "Follow-up 1 (EN)",
    language: "en",
    step: 2,
    subject: "Re: Quick audit of {{website}}",
    body: [
      "Hi {{name}} team,",
      "",
      "Just following up on the audit I sent over last week for {{website}}, in case it got buried.",
      "",
      "One thing that stood out: {{top_gap}}.",
      "",
      "Here's the full report:",
      "{{report_link}}",
      "",
      "If you have any questions, just reply to this email.",
      "",
      "Best,",
      "Meric Ozyon",
      "mericozyon.com/en",
      "",
      "Nine Nine LLC · 110 N Interstate 35, Suite 315-834, Round Rock, TX 78681",
      'If you\'d rather not get emails like this, just reply "no."',
    ].join("\n"),
  },
  {
    name: "Follow-up 2 (EN)",
    language: "en",
    step: 3,
    subject: "Re: Quick audit of {{website}}",
    body: [
      "Hi {{name}} team,",
      "",
      "I'll make this my last note so I don't clutter your inbox. If this isn't a priority right now, no worries at all.",
      "",
      "If you ever want help growing your conversion rate and sales, the report will stay here:",
      "{{report_link}}",
      "",
      "Just reply to this email anytime; I'm happy to set up a quick call.",
      "",
      "Best,",
      "Meric Ozyon",
      "mericozyon.com/en",
      "",
      "Nine Nine LLC · 110 N Interstate 35, Suite 315-834, Round Rock, TX 78681",
      'If you\'d rather not get emails like this, just reply "no."',
    ].join("\n"),
  },
  {
    name: "Rapor teklifi (TR)",
    language: "tr",
    step: 1,
    subject: "{{website}} için hazırladığım rapor",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "{{website}} için kısa bir SEO raporu hazırladım. En dikkat çekeni: {{top_gap}}.",
      "",
      "Raporda bunun gibi {{more_issues}} tespit daha var, ekran görüntüleriyle. Göndereyim mi?",
      "",
      "Meriç Özyön",
      "mericozyon.com",
      "",
      'Bu tür e-postalar istemezseniz "istemiyorum" yazmanız yeterli.',
    ].join("\n"),
  },
  {
    name: "Rapor teklifi, takip 1 (TR)",
    language: "tr",
    step: 2,
    subject: "Re: {{website}} için hazırladığım rapor",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "Geçen hafta {{website}} için hazırladığım raporu göndermemi ister misiniz diye sormuştum; gözünüzden kaçmış olabilir diye kısaca hatırlatıyorum.",
      "",
      'Raporda {{more_issues}} tespit daha var, hepsi ekran görüntüleriyle. "Evet" yazmanız yeterli, hemen göndereyim.',
      "",
      "Meriç Özyön",
      "mericozyon.com",
      "",
      'Bu tür e-postalar istemezseniz "istemiyorum" yazmanız yeterli.',
    ].join("\n"),
  },
  {
    name: "Rapor teklifi, takip 2 (TR)",
    language: "tr",
    step: 3,
    subject: "Re: {{website}} için hazırladığım rapor",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "Sizi daha fazla meşgul etmemek için bu son e-postam. Şu an önceliğiniz değilse hiç sorun değil.",
      "",
      "{{website}} için hazırladığım rapor bende duruyor. İleride isterseniz bu e-postayı yanıtlamanız yeterli, hemen gönderirim.",
      "",
      "Meriç Özyön",
      "mericozyon.com",
      "",
      'Bu tür e-postalar istemezseniz "istemiyorum" yazmanız yeterli.',
    ].join("\n"),
  },
  {
    name: "Report offer (EN)",
    language: "en",
    step: 1,
    subject: "The report I put together for {{website}}",
    body: [
      "Hi {{name}} team,",
      "",
      "I put together a short SEO report for {{website}}. The thing that stands out most: {{top_gap}}.",
      "",
      "The report has {{more_issues}} more findings like this one, with screenshots. Want me to send it over?",
      "",
      "Meric Ozyon",
      "mericozyon.com/en",
      "",
      "Nine Nine LLC · 110 N Interstate 35, Suite 315-834, Round Rock, TX 78681",
      'If you\'d rather not get emails like this, just reply "no."',
    ].join("\n"),
  },
  {
    name: "Report offer, follow-up 1 (EN)",
    language: "en",
    step: 2,
    subject: "Re: The report I put together for {{website}}",
    body: [
      "Hi {{name}} team,",
      "",
      "Last week I asked whether you'd like the report I put together for {{website}}. Just a quick nudge in case it got buried.",
      "",
      'It has {{more_issues}} more findings, all with screenshots. Just reply "yes" and I\'ll send it right over.',
      "",
      "Meric Ozyon",
      "mericozyon.com/en",
      "",
      "Nine Nine LLC · 110 N Interstate 35, Suite 315-834, Round Rock, TX 78681",
      'If you\'d rather not get emails like this, just reply "no."',
    ].join("\n"),
  },
  {
    name: "Report offer, follow-up 2 (EN)",
    language: "en",
    step: 3,
    subject: "Re: The report I put together for {{website}}",
    body: [
      "Hi {{name}} team,",
      "",
      "I'll make this my last note so I don't clutter your inbox. If this isn't a priority right now, no worries at all.",
      "",
      "I'll keep the report for {{website}} on hand. If you ever want it, just reply to this email and I'll send it over.",
      "",
      "Meric Ozyon",
      "mericozyon.com/en",
      "",
      "Nine Nine LLC · 110 N Interstate 35, Suite 315-834, Round Rock, TX 78681",
      'If you\'d rather not get emails like this, just reply "no."',
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
    more_issues: String(Math.max(lead.findings.length - 1, 0)),
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
