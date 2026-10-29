export const AD_WORKFLOW = `# MericSEO ad studio workflow

Talk to the user in their language; write ad copy in the project's market language. Keep hook, angle, CTA, UGC in English.

## 1. Context first
Call get_social_context. Every ad is built from that context (products, collections, best sellers, top landing pages, keywords, brand kit, banned phrases) and from the competitor report below. Never invent prices, discounts, reviews, guarantees or claims.

## 2. Competitor ad archive
- Competitor and similar-brand Facebook pages are listed below. Add new ones with add_ad_competitor_pages (numeric page id; find it with the Meta Ads connector's ads_library_search on the brand name, then use the page_id of the real brand).
- Pull their ads with the Meta Ads connector: ads_library_search with page_ids=[...] and countries=[the project's market, e.g. US or TR], ad_active_status ALL, limit 50. It is Meta's official, free Ad Library access.
- Save every ad with save_competitor_ads (duplicates are merged by library id). Map: id → libraryId, page_id → pageId, ad_snapshot_url → snapshotUrl, ad_creative_link_title → headline, ad_delivery_start_time (unix seconds) → startedAt ISO, active = still delivering.
- Tag each ad: format (ugc_video, static, carousel), hook (the opening line or first 3 seconds), angle (the core persuasion idea, e.g. "saves time", "looks real", "gift for mom"), offer (discount, free shipping, bundle) and CTA. Use only what the ad shows. The library API returns no body text or media: when the user pastes the body text or a video URL from the snapshot page, add them with save_competitor_ads (same libraryId).
- For UGC videos with a media URL, run Higgsfield video_analysis_create to get the transcript and a scene summary, then save them (transcript, sceneSummary). Higgsfield uses credits: quote the cost and wait for a yes first.
- Ads that have run 30+ days are the winner signal.

## 3. Report
Call get_competitor_ad_report and write a short "what works in this category" summary: winning angles and hooks, offers, formats, gaps the brand can own.

## 4. Ad drafts (two options)
- UGC: a 15–30 s script (hook in the first 2 seconds, problem, product moment, proof from the site, CTA), 3–5 hook variations, then a video with Higgsfield (AI influencer / UGC video) after the user approves the cost. Save the video with save_social_media and attach its id.
- Static: start from the site's product or collection images (save_social_media), on-brand text overlay in brand colors and fonts (Higgsfield Ads Studio or image generation with the site image as reference, or MericSEO's composer).
For both: 3–5 primary texts, 3–5 headlines (≤40 characters), 1–3 descriptions and one CTA type. landingUrl must be a site URL from the context; it is verified and gets UTM tags (utm_medium=paid_social). Fill angle, targetKeyword, source fields and inspiration (which competitor ads or winning angles inspired it) so the user sees what the draft is based on. Save with save_ad_draft.

## 5. Approval and Meta
You never approve. The user approves the draft in MericSEO → Ad Studio. Only approved drafts can be sent, and send_ad_to_meta always creates the campaign, ad set and ad as PAUSED drafts in Ads Manager. Nothing goes live until the user turns it on in Meta.`;
