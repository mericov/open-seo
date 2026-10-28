import type { PageCheckId } from "@/shared/pageTracking";

const MAX_CONTENT_CHARS = 40_000;
const DROPPED_BLOCKS =
  /<(script|style|noscript|svg|nav|header|footer|form|iframe|aside)\b[\s\S]*?<\/\1>/gi;

type Language = "tr" | "en";

type PromptKeyword = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  searchVolume: number | null;
};

type PromptInput = {
  language: Language;
  post: {
    url: string;
    kind: "blog" | "category";
    targetKeyword: string | null;
  };
  page: {
    title: string;
    metaDescription: string;
    h1: string | null;
    wordCount: number;
  } | null;
  html: string | null;
  insights: {
    keywords: PromptKeyword[];
    opportunities: (PromptKeyword & { reason: "striking" | "low_ctr" })[];
    checks: { id: PageCheckId; ok: boolean; value: number | null }[];
    links: {
      outbound: { url: string; label: string }[];
      inbound: { url: string; label: string }[];
    };
    advice: {
      summary: string;
      titles: string[];
      metaDescriptions: string[];
      actions: { area: string; text: string }[];
      faqQuestions: string[];
    } | null;
  };
};

const CHECK_LABELS: Record<Language, Record<PageCheckId, string>> = {
  tr: {
    title_length: "Başlık uzunluğu 30-65 karakter değil",
    meta_description: "Meta description 70-160 karakter değil",
    single_h1: "Tam olarak bir H1 yok",
    article_schema: "Article/BlogPosting schema yok",
    category_schema: "CollectionPage/ItemList/BreadcrumbList schema yok",
    image_alt: "Alt metni olmayan görseller var",
    word_count: "İçerik konuya göre kısa",
    canonical: "Canonical eksik ya da başka adresi gösteriyor",
    indexed: "Google sayfayı indekslememiş",
    faq: "FAQ bölümü yok",
    question_headings: "Soru şeklinde ara başlık az",
    lists_tables: "Liste veya tablo yok",
    author: "Yazar bilgisi yok",
    dates: "Yayın/güncelleme tarihi yok",
    fresh: "İçerik uzun süredir güncellenmemiş",
    citations: "Dış kaynak linki az",
  },
  en: {
    title_length: "Title is not 30-65 characters",
    meta_description: "Meta description is not 70-160 characters",
    single_h1: "Not exactly one H1",
    article_schema: "No Article/BlogPosting schema",
    category_schema: "No CollectionPage/ItemList/BreadcrumbList schema",
    image_alt: "Images without alt text",
    word_count: "Content is thin for the topic",
    canonical: "Canonical missing or pointing elsewhere",
    indexed: "Google hasn't indexed the page",
    faq: "No FAQ section",
    question_headings: "Few question-style subheadings",
    lists_tables: "No lists or tables",
    author: "No author shown",
    dates: "No publish/update date",
    fresh: "Content not updated for a long time",
    citations: "Few links to outside sources",
  },
};

const TEXT = {
  tr: {
    intro: (kind: string, url: string) =>
      `Aşağıdaki ${kind === "blog" ? "blog yazısını" : "kategori sayfasını"} SEO ve GEO (ChatGPT, Perplexity, Gemini, Google AI Overviews gibi AI cevaplarında kaynak gösterilme) için yeniden yazmanı/güncellemeni istiyorum. Adres: ${url}`,
    rules: [
      "Adres (URL) aynı kalacak; içeriğin konusu ve amacı korunacak.",
      "Search Console verisindeki keyword'leri, hacmi ve gösterimi yüksek olanlara öncelik vererek başlığa, H2/H3'lere ve ilk paragrafa doğal şekilde yerleştir. Keyword doldurma yapma.",
      "İlk paragrafta konuya doğrudan, net bir cevap ver (AI'ların alıntılayacağı kısa tanım).",
      "Aşağıdaki SEO/GEO eksiklerini gider ve iç link önerilerini uygun yerlere anchor text ile ekle.",
      "Gerçek olmayan bilgi, istatistik ya da kaynak uydurma. Emin olmadığın yerleri [kontrol et] diye işaretle.",
      "Doğal, insan yazımı gibi bir Türkçe kullan. SEO terimleri İngilizce kalabilir.",
    ],
    output:
      "Çıktı olarak ver: 1) SEO başlığı (50-60 karakter), 2) meta description (140-155 karakter), 3) H1, 4) güncellenmiş tam içerik (HTML; H2/H3, listeler ve gerekiyorsa tablo ile), 5) FAQ bölümü (soru-cevap), 6) FAQPage ve Article/BlogPosting JSON-LD schema, 7) yaptığın değişikliklerin kısa listesi.",
    current: "Mevcut durum",
    title: "Başlık",
    meta: "Meta description",
    words: "Kelime sayısı",
    target: "Hedef keyword",
    keywords:
      "Search Console keyword'leri (tıklama / gösterim / ort. sıra / aylık hacim)",
    opportunities: "Öncelikli keyword fırsatları",
    striking: "ilk 3'e çıkabilir",
    lowCtr: "sırası iyi ama az tıklanıyor",
    checks: "Giderilmesi gereken SEO/GEO eksikleri",
    linksOut: "Bu sayfadan verilecek iç linkler",
    linksIn: "Bu sayfaya link vermesi gereken sayfalar (bilgi için)",
    advice: "Daha önce alınan yapay zeka önerileri",
    content: "Mevcut içerik",
    unreachable:
      "(Sayfa içeriği okunamadı, yukarıdaki verilere göre yeni içerik yaz.)",
    noVolume: "bilinmiyor",
  },
  en: {
    intro: (kind: string, url: string) =>
      `Rewrite/update the following ${kind === "blog" ? "blog post" : "category page"} for SEO and GEO (being cited as a source in AI answers such as ChatGPT, Perplexity, Gemini and Google AI Overviews). URL: ${url}`,
    rules: [
      "Keep the URL, topic and purpose of the page.",
      "Work the Search Console keywords naturally into the title, H2/H3s and first paragraph, prioritizing the ones with the most volume and impressions. No keyword stuffing.",
      "Open with a direct, clear answer to the topic (a short definition AI assistants can quote).",
      "Fix the SEO/GEO gaps below and add the suggested internal links with good anchor text.",
      "Don't invent facts, statistics or sources. Mark anything you're unsure of as [verify].",
      "Write naturally, like a person would.",
    ],
    output:
      "Output: 1) SEO title (50-60 characters), 2) meta description (140-155 characters), 3) H1, 4) the full updated content (HTML with H2/H3, lists and a table where useful), 5) an FAQ section, 6) FAQPage and Article/BlogPosting JSON-LD schema, 7) a short list of the changes you made.",
    current: "Current state",
    title: "Title",
    meta: "Meta description",
    words: "Word count",
    target: "Target keyword",
    keywords:
      "Search Console keywords (clicks / impressions / avg. position / monthly volume)",
    opportunities: "Priority keyword opportunities",
    striking: "can reach the top 3",
    lowCtr: "ranks well but gets few clicks",
    checks: "SEO/GEO gaps to fix",
    linksOut: "Internal links to add from this page",
    linksIn: "Pages that should link here (for context)",
    advice: "Earlier AI advice",
    content: "Current content",
    unreachable:
      "(The page content couldn't be read; write new content from the data above.)",
    noVolume: "unknown",
  },
};

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function htmlToMarkdown(html: string) {
  const main =
    /<article\b[\s\S]*?<\/article>/i.exec(html)?.[0] ??
    /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ??
    /<body\b[\s\S]*?<\/body>/i.exec(html)?.[0] ??
    html;
  const text = main
    .replace(DROPPED_BLOCKS, " ")
    .replace(
      /<h([1-4])\b[^>]*>/gi,
      (_, level: string) => `\n\n${"#".repeat(Number(level))} `,
    )
    .replace(/<\/h[1-4]>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<(tr)\b[^>]*>/gi, "\n| ")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<(br|\/p|\/div|\/ul|\/ol|\/table)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim()
    .slice(0, MAX_CONTENT_CHARS);
}

export function buildRewritePrompt(input: PromptInput) {
  const text = TEXT[input.language];
  const { insights, page, post } = input;
  const volume = (value: number | null) =>
    value === null ? text.noVolume : String(value);
  const lines: string[] = [
    text.intro(post.kind, post.url),
    "",
    ...text.rules.map((rule) => `- ${rule}`),
    "",
    text.output,
    "",
    `## ${text.current}`,
    `- ${text.title}: ${page?.title ?? "-"}`,
    `- ${text.meta}: ${page?.metaDescription || "-"}`,
    `- H1: ${page?.h1 ?? "-"}`,
    `- ${text.words}: ${page?.wordCount ?? "-"}`,
    `- ${text.target}: ${post.targetKeyword ?? "-"}`,
  ];
  if (insights.keywords.length > 0) {
    lines.push("", `## ${text.keywords}`);
    for (const row of insights.keywords) {
      lines.push(
        `- ${row.query}: ${row.clicks} / ${row.impressions} / ${row.position.toFixed(1)} / ${volume(row.searchVolume)}`,
      );
    }
  }
  if (insights.opportunities.length > 0) {
    lines.push("", `## ${text.opportunities}`);
    for (const row of insights.opportunities) {
      lines.push(
        `- ${row.query} (${row.position.toFixed(1)}, ${row.reason === "low_ctr" ? text.lowCtr : text.striking}, ${volume(row.searchVolume)})`,
      );
    }
  }
  const failed = insights.checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    lines.push("", `## ${text.checks}`);
    for (const check of failed) {
      lines.push(
        `- ${CHECK_LABELS[input.language][check.id]}${check.value !== null ? ` (${check.value})` : ""}`,
      );
    }
  }
  if (insights.links.outbound.length > 0) {
    lines.push("", `## ${text.linksOut}`);
    for (const link of insights.links.outbound) {
      lines.push(`- ${link.label}: ${link.url}`);
    }
  }
  if (insights.links.inbound.length > 0) {
    lines.push("", `## ${text.linksIn}`);
    for (const link of insights.links.inbound) {
      lines.push(`- ${link.label}: ${link.url}`);
    }
  }
  if (insights.advice) {
    lines.push("", `## ${text.advice}`, insights.advice.summary);
    for (const action of insights.advice.actions) {
      lines.push(`- [${action.area}] ${action.text}`);
    }
    for (const question of insights.advice.faqQuestions) {
      lines.push(`- FAQ: ${question}`);
    }
  }
  lines.push(
    "",
    `## ${text.content}`,
    input.html ? htmlToMarkdown(input.html) : text.unreachable,
  );
  return lines.join("\n");
}
