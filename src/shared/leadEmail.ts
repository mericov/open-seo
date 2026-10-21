import type { LeadFindingCode } from "@/shared/leadFindings";

export const LEAD_EMAIL_LANGUAGES = ["tr", "en"] as const;
export type LeadEmailLanguage = (typeof LEAD_EMAIL_LANGUAGES)[number];

export const LEAD_TEMPLATE_VARIABLES = [
  "name",
  "first_line",
  "website",
  "top_gap",
] as const;

export type LeadMailClient = "gmail" | "mailto";

const GAP_PHRASES: Record<
  LeadEmailLanguage,
  Record<LeadFindingCode, string>
> = {
  en: {
    no_website: "you don't have a website on Google yet",
    no_https: "your site isn't on a secure connection",
    not_mobile_friendly: "your site looks hard to use on phones",
    no_analytics: "I couldn't see analytics tracking on your site",
    no_meta_pixel: "I couldn't see a Meta pixel for retargeting",
    no_meta_description: "Google has no description to show for your site",
    no_schema: "Google and AI assistants get little detail about your site",
    no_blog: "your site has no articles bringing in search traffic",
    heavy_page: "your home page is heavy and likely slow",
    few_reviews: "you have only a few Google reviews",
  },
  tr: {
    no_website: "Google'da henüz bir web siteniz görünmüyor",
    no_https: "siteniz güvenli bağlantı kullanmıyor",
    not_mobile_friendly: "siteniz telefonda zor kullanılıyor gibi görünüyor",
    no_analytics: "sitenizde ziyaretçi takibi göremedim",
    no_meta_pixel: "reklamlar için Meta pixel göremedim",
    no_meta_description: "Google'ın sitenizi anlatacak bir açıklaması yok",
    no_schema:
      "Google ve yapay zeka asistanları siteniz hakkında az bilgi alıyor",
    no_blog: "sitenizde aramadan trafik getirecek yazılar yok",
    heavy_page: "ana sayfanız ağır ve muhtemelen yavaş açılıyor",
    few_reviews: "Google'da az yorumunuz var",
  },
};

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
    name: "Ücretsiz rapor (TR)",
    language: "tr",
    subject: "{{name}} için kısa bir fikir",
    body: [
      "Merhaba {{name}} ekibi,",
      "",
      "{{first_line}}",
      "",
      "Ben Meriç; işletmelerin Google'da ve ChatGPT gibi yapay zeka asistanlarında daha kolay bulunmasına yardımcı oluyorum. İsterseniz neleri iyileştirebileceğinizi gösteren kısa raporu bu hafta gönderebilirim. Ücretsiz ve görüşme gerektirmiyor.",
      "",
      "Sevgiler,",
      "Meriç",
      "mericozyon.com",
      "",
      "[Şirket adresin]",
      'Bu tür e-postalar almak istemezseniz "hayır" yazmanız yeterli, bir daha yazmam.',
    ].join("\n"),
  },
  {
    name: "Free report (EN)",
    language: "en",
    subject: "Quick idea for {{name}}",
    body: [
      "Hi {{name}} team,",
      "",
      "{{first_line}}",
      "",
      "I'm Meriç, and I help businesses get found on Google and in AI assistants like ChatGPT. If you'd like, I can send you a short report this week showing what you could improve. It's free and there's no call needed.",
      "",
      "Best,",
      "Meriç",
      "mericozyon.com",
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
  },
  language: LeadEmailLanguage,
): Record<(typeof LEAD_TEMPLATE_VARIABLES)[number], string> {
  const topGap = lead.findings[0];
  return {
    name: lead.name,
    first_line: lead.firstLine ?? FALLBACK_FIRST_LINE[language],
    website: lead.domain ?? lead.website ?? "",
    top_gap: topGap ? GAP_PHRASES[language][topGap] : "",
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
