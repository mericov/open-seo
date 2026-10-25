import type { LeadFindingCode } from "@/shared/leadFindings";

type Phrases = Record<LeadFindingCode, string>;

const EN: Phrases = {
  no_website: "you don't have a website on Google yet",
  unclaimed_profile: "your Google Business Profile isn't claimed yet",
  few_reviews: "you have only a few Google reviews",
  low_rating: "your Google rating is below 4 stars ({detail})",
  no_hours: "your Google listing doesn't show opening hours",
  few_photos: "your Google listing has only a few photos ({detail})",
  no_click_to_call: "visitors on phones can't tap to call you from your site",
  no_online_booking: "I couldn't see a way to book online on your site",
  noindex_home: "your home page tells Google not to show it in search",
  no_https: "your site isn't on a secure connection",
  http_not_redirected:
    "the http version of your site doesn't send visitors to the secure one",
  not_mobile_friendly: "your site looks hard to use on phones",
  weak_title: "your home page title doesn't tell Google what you offer",
  no_meta_description: "Google has no description to show for your site",
  h1_issue: "your home page has no clear main heading for Google",
  no_canonical: "your pages don't tell Google which address is the main one",
  missing_alt: "many images on your site have no description ({detail})",
  no_sitemap: "I couldn't find a sitemap that helps Google find your pages",
  no_open_graph: "links to your site show no preview image when shared",
  no_lang: "your site doesn't say which language it's in",
  thin_content: "your home page has very little text for Google to read",
  no_hreflang: "your language versions aren't linked for Google",
  heavy_page: "your home page is heavy and likely slow",
  unoptimized_images: "your images load all at once, which slows the page",
  too_many_scripts:
    "your site loads scripts from many outside services ({detail}), which slows it down",
  ai_bots_blocked:
    "your site blocks AI assistants like ChatGPT from reading it ({detail})",
  no_schema: "Google and AI assistants get little detail about your site",
  no_org_schema:
    "your site doesn't describe your business in a way AI assistants can read",
  no_faq: "I couldn't see an FAQ section that AI assistants could quote",
  no_review_schema: "your star ratings aren't shown in Google results",
  no_llms_txt: "your site has no llms.txt guide for AI assistants",
  no_blog: "your site has no regular blog to bring in search and AI traffic",
  stale_blog: "your blog hasn't had a new post in a while (last: {detail})",
  irregular_blog:
    "your blog isn't updated regularly ({detail} posts in the last 3 months)",
  myshopify_domain: "your store still runs on a myshopify.com address",
  vintage_theme:
    "your store runs on an old Shopify theme ({detail}) that misses newer features",
  stock_theme: "your store uses a free stock theme ({detail})",
  old_copyright: "your footer still shows an old year ({detail})",
  powered_by_shopify: 'your footer still shows "Powered by Shopify"',
  no_favicon: "your site has no icon in the browser tab",
  legacy_analytics:
    "your site still uses old Google Analytics, which stopped collecting data in 2023",
  no_analytics: "I couldn't see analytics tracking on your site",
  no_meta_pixel: "I couldn't see a Meta pixel for retargeting",
  no_google_ads_tag: "I couldn't see Google Ads conversion tracking",
  no_tiktok_pixel: "I couldn't see a TikTok pixel",
  no_pinterest_tag: "I couldn't see a Pinterest tag",
  no_heatmap:
    "I couldn't see a tool that shows how visitors use your site, like Clarity or Hotjar",
  no_consent_banner:
    "I couldn't see a cookie consent banner, which Google Ads needs in Europe",
  no_email_marketing:
    "I couldn't find an email signup form on your site, so first-time visitors who don't buy are hard to win back",
  mailchimp_store:
    "your store uses Mailchimp, which does less for online stores than tools like Klaviyo",
  no_spf: "your domain has no SPF record, so your emails can land in spam",
  no_dmarc: "your domain has no DMARC record, which Gmail and Yahoo now expect",
  free_email_contact: "your contact address is on a free email service",
  no_reviews_app: "I couldn't see product reviews on your store",
  no_live_chat: "I couldn't see a chat or WhatsApp button for quick questions",
  out_of_stock: "many of your products show as sold out ({detail})",
  empty_descriptions: "some products have no description ({detail})",
  single_image_products: "many products have only one photo ({detail})",
  stale_products: "no new products have been added in a while (last: {detail})",
  no_product_schema:
    "your product pages don't give Google product details, which Google Shopping relies on",
  product_schema_gaps:
    "your product pages are missing details Google Shopping asks for ({detail})",
  no_social_links: "your site doesn't link to your social accounts",
  no_about_page: "I couldn't find an about page that builds trust",
  no_privacy_policy: "I couldn't find a privacy policy on your site",
  no_refund_policy: "I couldn't find a return or refund policy",
  no_kvkk: "I couldn't find a KVKK notice on your site",
};

const TR: Phrases = {
  no_website: "Google'da henüz bir web siteniz görünmüyor",
  unclaimed_profile: "Google işletme profiliniz henüz sahiplenilmemiş",
  few_reviews: "Google'da az yorumunuz var",
  low_rating: "Google puanınız 4'ün altında ({detail})",
  no_hours: "Google kaydınızda çalışma saatleri görünmüyor",
  few_photos: "Google kaydınızda az fotoğraf var ({detail})",
  no_click_to_call:
    "telefondan gelen ziyaretçiler sitenizden tek dokunuşla arayamıyor",
  no_online_booking: "sitenizde online randevu alma imkânı göremedim",
  noindex_home: "ana sayfanız Google'a kendini aramada göstermemesini söylüyor",
  no_https: "siteniz güvenli bağlantı kullanmıyor",
  http_not_redirected:
    "sitenizin http adresi ziyaretçileri güvenli adrese yönlendirmiyor",
  not_mobile_friendly: "siteniz telefonda zor kullanılıyor gibi görünüyor",
  weak_title: "ana sayfa başlığınız Google'a ne sunduğunuzu anlatmıyor",
  no_meta_description: "Google'ın sitenizi anlatacak bir açıklaması yok",
  h1_issue: "ana sayfanızda Google için net bir ana başlık yok",
  no_canonical:
    "sayfalarınız Google'a asıl adresin hangisi olduğunu söylemiyor",
  missing_alt: "sitenizdeki görsellerin çoğunda açıklama yok ({detail})",
  no_sitemap:
    "Google'ın sayfalarınızı bulmasını sağlayan site haritasını bulamadım",
  no_open_graph: "siteniz paylaşıldığında önizleme görseli çıkmıyor",
  no_lang: "siteniz hangi dilde olduğunu belirtmiyor",
  thin_content: "ana sayfanızda Google'ın okuyabileceği çok az yazı var",
  no_hreflang: "dil seçenekleriniz Google için birbirine bağlanmamış",
  heavy_page: "ana sayfanız ağır ve muhtemelen yavaş açılıyor",
  unoptimized_images:
    "görselleriniz hepsi birden yükleniyor ve sayfayı yavaşlatıyor",
  too_many_scripts:
    "siteniz çok sayıda dış servisten kod yüklüyor ({detail}) ve bu siteyi yavaşlatıyor",
  ai_bots_blocked:
    "siteniz ChatGPT gibi yapay zeka asistanlarının sitenizi okumasını engelliyor ({detail})",
  no_schema:
    "Google ve yapay zeka asistanları siteniz hakkında az bilgi alıyor",
  no_org_schema:
    "siteniz işletmenizi yapay zeka asistanlarının okuyabileceği şekilde tanıtmıyor",
  no_faq:
    "yapay zeka asistanlarının alıntılayabileceği bir SSS bölümü göremedim",
  no_review_schema: "yıldız puanlarınız Google sonuçlarında görünmüyor",
  no_llms_txt: "sitenizde yapay zeka asistanları için llms.txt rehberi yok",
  no_blog:
    "sitenizde arama ve yapay zekâ trafiği getirecek düzenli bir blog yok",
  stale_blog: "blogunuza bir süredir yeni yazı eklenmemiş (son: {detail})",
  irregular_blog: "blogunuz düzenli güncellenmiyor (son 3 ayda {detail} yazı)",
  myshopify_domain: "mağazanız hâlâ myshopify.com adresinde çalışıyor",
  vintage_theme:
    "mağazanız yeni özellikleri olmayan eski bir Shopify temasında ({detail})",
  stock_theme: "mağazanız ücretsiz hazır bir tema kullanıyor ({detail})",
  old_copyright: "sitenizin alt kısmında hâlâ eski bir yıl yazıyor ({detail})",
  powered_by_shopify:
    'sitenizin alt kısmında hâlâ "Powered by Shopify" yazıyor',
  no_favicon: "sitenizin tarayıcı sekmesinde bir simgesi yok",
  legacy_analytics:
    "siteniz 2023'te veri toplamayı bırakan eski Google Analytics'i kullanıyor",
  no_analytics: "sitenizde ziyaretçi takibi göremedim",
  no_meta_pixel: "reklamlar için Meta pixel göremedim",
  no_google_ads_tag: "Google Ads dönüşüm takibi göremedim",
  no_tiktok_pixel: "TikTok pixel göremedim",
  no_pinterest_tag: "Pinterest etiketi göremedim",
  no_heatmap:
    "ziyaretçilerin sitenizi nasıl kullandığını gösteren Clarity veya Hotjar gibi bir araç göremedim",
  no_consent_banner:
    "Avrupa'da Google Ads için gereken çerez onay penceresini göremedim",
  no_email_marketing:
    "sitenizde e-posta kayıt formu göremedim; ilk kez gelip almayan ziyaretçiye tekrar ulaşmak zor",
  mailchimp_store:
    "mağazanız Mailchimp kullanıyor, Klaviyo gibi araçlar e-ticaret için çok daha fazlasını yapıyor",
  no_spf: "alan adınızda SPF kaydı yok, mailleriniz spam'e düşebilir",
  no_dmarc: "alan adınızda Gmail ve Yahoo'nun artık beklediği DMARC kaydı yok",
  free_email_contact: "iletişim adresiniz ücretsiz bir e-posta servisinde",
  no_reviews_app: "mağazanızda ürün yorumları göremedim",
  no_live_chat:
    "hızlı sorular için canlı destek veya WhatsApp butonu göremedim",
  out_of_stock: "ürünlerinizin önemli bir kısmı tükenmiş görünüyor ({detail})",
  empty_descriptions: "bazı ürünlerinizin açıklaması yok ({detail})",
  single_image_products: "birçok ürününüzde tek fotoğraf var ({detail})",
  stale_products: "bir süredir yeni ürün eklenmemiş (son: {detail})",
  no_product_schema:
    "ürün sayfalarınız Google Alışveriş'in kullandığı ürün bilgilerini vermiyor",
  product_schema_gaps:
    "ürün sayfalarınızda Google Alışveriş'in istediği bilgiler eksik ({detail})",
  no_social_links: "siteniz sosyal medya hesaplarınıza bağlantı vermiyor",
  no_about_page: "güven veren bir hakkımızda sayfası bulamadım",
  no_privacy_policy: "sitenizde gizlilik politikası bulamadım",
  no_refund_policy: "iade veya değişim politikası bulamadım",
  no_kvkk: "sitenizde KVKK aydınlatma metni bulamadım",
};

const PHRASES = { en: EN, tr: TR };

export function findingPhrase(
  code: LeadFindingCode,
  language: "en" | "tr",
  detail?: string | null,
): string {
  const phrase = PHRASES[language][code];
  return detail
    ? phrase.replace("{detail}", detail)
    : phrase.replace(/\s*\([^)]*\{detail\}[^)]*\)/, "");
}

export function findingBullets(
  codes: readonly LeadFindingCode[],
  language: "en" | "tr",
  details: Partial<Record<LeadFindingCode, string>> = {},
): string {
  return codes
    .map((code) => {
      const phrase = findingPhrase(code, language, details[code]);
      return `- ${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
    })
    .join("\n");
}
