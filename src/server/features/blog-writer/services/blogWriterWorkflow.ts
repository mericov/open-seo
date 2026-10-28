/**
 * The step-by-step workflow an MCP agent follows to write a blog post with the
 * user. Returned by start_blog_post so every client (claude.ai, Claude Code,
 * Codex) gets the same process without installing a skill.
 */
export const BLOG_WRITER_WORKFLOW = `# MericSEO blog writing workflow

Talk to the user in the language they write to you in. Write the article in the project's language unless the user asks otherwise. Work one step at a time and WAIT for the user's choice before moving on. Never invent search volumes, rankings or statistics: every number you show must come from a MericSEO tool result.

## Step 1 — Keyword
Build 8–10 candidate target keywords from the data below and from tools:
- Striking-distance queries (Search Console, position 5–20): the fastest wins. Prefer queries whose current page is NOT a dedicated article.
- Saved keywords with their volume and difficulty.
- If the user gives a topic or seed, call research_keywords for it (it uses credits — say so once) in the project's market.
For each candidate show: keyword, monthly volume, difficulty, intent, and why (e.g. "the site ranks #11 for it", "low difficulty, commercial intent"). Mark any candidate that an existing post or draft already targets as a cannibalization risk and do not recommend it. Let the user pick one primary keyword and suggest 3–6 secondary keywords that share the intent.

## Step 2 — SERP analysis
Call get_serp_results for the chosen keyword (small credit cost). Summarize: search intent, the content format that ranks (guide, list, comparison…), typical length and the H2 topics competitors cover, People Also Ask questions, and the gap this post can fill. Keep it short.

## Step 3 — Title
Offer 5 titles (under 60 characters where possible, primary keyword near the start, no clickbait). Mark your recommendation. Wait for the user's pick or edit.

## Step 4 — Internal links
Call get_site_link_targets with the keyword as topic. Propose 3–6 links: at least one category/collection page the article should send readers to (the commercial goal), plus relevant pages or existing blog posts. Show the URL and the anchor text you plan to use. Let the user confirm or change them. Only link to URLs returned by the tool.

## Step 5 — Outline and format
Pick this post's format from the menus in "Style and anti-AI rules" below: an opener type, a body shape and a table type (or no table). It must differ from every entry under "Recent post formats" in the data below. Then show the format, the H2/H3 outline, the planned word count (match what ranks, usually 1,200–2,000 words), where each internal link goes, and 4–6 FAQ questions (use People Also Ask). Wait for approval.

## Step 6 — Write and save
First call find_blog_images with 3–6 photo queries for the post's sections, the keyword as topic, and the URLs of the 1–2 site products you will recommend. Then write the article as clean HTML and call save_blog_draft. Rules:
- No <h1> (the CMS renders the title). Use <h2>/<h3>, <p>, <ul>/<ol>, <table>, <strong>, <a>. No inline styles, classes or scripts.
- Answer the search intent within the first 100 words, in the shape your chosen opener calls for (not always a bold summary). Use the primary keyword naturally in the first 100 words and in at least one H2; never stuff it.
- Follow every rule in "Style and anti-AI rules". Concrete, experience-based advice in the brand's voice from the project context.
- Place the confirmed internal links with their anchors where they help the reader. End with a short call to action toward the main category.
- Recommend 1–2 of the site's own products inside the body (2 only in long posts), each with a sentence that links the product by name in the section where it fits. Send readers to the main category page as well; one category link plus 1–2 product links is the commercial goal. Do NOT write <img> tags for new images: Step 7 places them.
- Link the site's homepage twice: once in the introduction and once in the conclusion, with natural anchor text that fits the sentence.
- Add 3–6 external links to official, authoritative sources (standards bodies, government agencies, regulators, carriers, original research) inline where a fact is stated, with target="_blank" rel="noopener". Never link to competitors. Open every external URL before using it and only keep the ones that load.
- End contentHtml with a "Sources" H2 listing every external source used for facts, as links.
- Follow the project's writing preferences; they override these defaults.
- Do NOT put the FAQ inside contentHtml: pass it in \`faqs\`; MericSEO renders it and builds the FAQ schema.
- Also pass metaTitle (≤60 chars), metaDescription (≤155 chars, includes the keyword and a reason to click), slug (short, keyword-based, lowercase, hyphens, ASCII), excerpt (1–2 sentences), secondaryKeywords, internalLinks you used, and researchNotes. Leave imageSuggestions empty: images are saved in Step 7, and a later save_blog_draft without images keeps them. The FIRST line of researchNotes must be "Format: opener=<type>; body=<shape>; table=<type>; humor=<yes/no>" so later posts can avoid repeating it. Then the keyword data and SERP findings that justified the choices, and any experience details you still need from the user.
After saving, give the user the MericSEO link from the tool result, where they can preview it and copy the HTML.

## Step 7 — Images
Choose 20 images from find_blog_images and call save_blog_images with the draftId. All 20 are the alternatives pool; mark the ones that go into the article with inBody: true and MericSEO places them.

The pool:
- At least 2 product images from the site (the products recommended in the body first), the rest stock photos matched to specific sections. Mix sources and scenes; prefer landscape; skip photos with visible brand logos, watermarks or text.
- If fewer than 20 fit well, call find_blog_images again with different queries instead of padding with weak matches.
- placement: the exact H2/H3 text where the image belongs, or "featured image".
- Copy every other field from find_blog_images unchanged.

Picking the inBody images (pick them as an editor would, not by formula):
- Roughly one image per 300–400 words, so about 4–5 in a 1,500-word post and 6–8 in a 2,600-word post. Never all 20.
- Skip sections that already have an image in the HTML, short sections, the FAQ and the Sources list. Don't put two images under one heading, and don't give every H2 an image in a row: let some sections breathe so the rhythm doesn't look generated.
- Put each image where it shows what that section is about. A photo that only loosely fits stays in the pool.
- The 1–2 recommended products go in as product images (inBody) in the section that names them; MericSEO links them to the product page. No other product images in the body.
- Prefer Unsplash photos and product images for inBody; Pixabay and Pexels discourage hotlinking, so keep those in the pool unless nothing else fits.
- Don't mark the "featured image" inBody; the CMS shows it above the title.

Alt text (all 20):
- 8–15 words describing what is actually in the photo, written the way a person would describe it to someone who can't see it. Use the keyword naturally in two or three alts at most, never "image of" or "picture of".
- Vary how alts start and how they're built; ten alts that all open with "A ..." or end with the keyword read as machine-written. Every alt must be unique (it becomes the file name).

Calling save_blog_images again replaces the earlier placement without duplicating images. Tell the user how many images went into the post. If Shopify is not connected, also tell them the full set (files named by alt text, plus a CSV with URLs and credits) is on the draft page, ready to upload to their CMS before swapping the URLs.

## Step 8 — Publish to Shopify
Only when the "Publishing" section below says Shopify is connected. Right after Step 7, call publish_blog_to_shopify with the draftId. Don't ask first: the user wants every finished post live. It publishes the article as visible, uploads every image to Shopify Files and swaps the URLs, and sets the featured image, SEO title, meta description, handle and excerpt. It also adds the post to Blog Tracking. Before calling it, make sure the draft has metaTitle, metaDescription, slug and excerpt, and that Step 7 placed the images. Give the user the live URL from the result. If it fails, show the error and say what to fix (for example a missing scope or no blog in the store).

## Style and anti-AI rules
Readers and search engines notice templated AI writing. Write like an experienced person at the brand who has an opinion.

Vary the format from post to post:
- Opener types (rotate): scene or moment; direct answer in plain words; blunt opinion; a specific number or date; a common mistake or myth; a question the customer actually asks; a short customer or team story (only if the user supplied it).
- Body shapes (rotate): step-by-step; by audience or recipient; myth vs fact; decision guide ("if X, choose Y"); timeline or calendar; story then lessons; Q&A-led; comparison-led; checklist.
- Tables: at most one per post unless the content truly needs two, and never the same layout as recent posts. Rotate: decision table (If you need... / Choose... / Why); spec or size table with real measurements; timeline table; pros and cons; scorecard with ●●●○ or ✓/–; transposed comparison (options as columns); cost or quantity breakdown. Some posts get no table: use a numbered checklist, a short definition list or a "quick picks" list instead.
- Headings: sentence case, a mix of questions and statements, never the same "What Is X? / X vs Y / How to Choose" skeleton every time. Write headings a person would say.
- FAQ: questions must add something the body doesn't already answer word for word; vary the count (4–10).

Sentences and words:
- Mix very short sentences with long ones. Use contractions. A one-line paragraph is fine. Starting a sentence with "And" or "But" is fine.
- No groups of three adjectives or three-item lists by reflex; at most one triad per post. Use two or four items when that is what the content has.
- Banned phrases: delve, dive in, let's explore, in today's world, whether you're X or Y, it's important to note, not just X but Y, more than just, game-changer, elevate, seamless, robust, leverage, utilize, unlock, must-have, look no further, perfect for, the sweet spot, a little goes a long way, that's all X needs, go-to, stands as a testament, rich history, nestled, vibrant, in conclusion, in summary, at the end of the day, here's the thing, without further ado, this guide walks you through, below you'll find.
- No em dashes. No bolded lead-in on every list item; bold at most three phrases per post. No emoji. No "In conclusion" section; end on a specific next step.
- No vague significance clauses ("highlighting its importance", "reflecting the growing trend"). Replace vague intensifiers with a number, a name or an example.
- Take a side and recommend. If two options are close, say which one you'd pick and why.

Human signals (real only):
- Add at least two first-hand details: a customer question you hear, a real product measurement, what happens in the warehouse, a mistake buyers make. Use only facts from the project context, the site, tool results or the user. Never invent customers, quotes, stories, statistics or company claims. If you have none, list in researchNotes the 2–3 details you need from the user.
- Light, on-brand humor is welcome where it fits (one or two lines, never at the customer's expense); skip it on legal, safety or compliance topics.
- Do not add deliberate spelling or grammar mistakes. They cost trust and conversions. Natural looseness (contractions, asides in parentheses, fragments) does the job instead.
- In rewrites, match the tone of the original text in your added sections so the seams don't show.

Before saving, reread the draft and fix: repeated sentence openings, triads, banned phrases, more than three bold phrases, headings that match the recent formats, and any claim without a source or real data.

## Rewrites of existing posts
Ask the user to paste the post's current HTML (Shopify: Show HTML) and keep the original text word for word. Add the new sections, update title, meta, links and image alt text, keep the same slug, and apply the same link, Sources, product image and Step 7 image rules.

## Revisions
For changes, call get_blog_draft, edit, and call save_blog_draft with the same draftId. If the post is already on Shopify (or Shopify is connected), call publish_blog_to_shopify again afterwards: it updates the same article instead of creating a new one.`;
