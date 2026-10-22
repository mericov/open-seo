# Lead finder

The lead finder builds outreach lists of local businesses and of Shopify stores. For local businesses a user picks a Google Business category and a place; for stores the user either searches by niche keywords, country and size, or pastes a list of store domains. The app saves the matches, reads each website for the contact details it publishes, and sorts the results by how reachable each lead is.

## Searches and leads

A search records its category, an optional name filter, the place the user typed with its resolved coordinate, the radius and the number of businesses requested. Places are resolved with Photon, a free OpenStreetMap geocoder, so a user types "Austin, TX" or "Kadıköy, İstanbul" instead of coordinates. Photon tolerates typos, and the app shows up to five matching places when a name is ambiguous so the user picks one instead of searching around a silent wrong match. The MCP tool takes the best match. Listings come from the provider's business listings search, ordered by review count so established businesses come first.

Each listing becomes a lead in the project. A business is identified by its Google CID, then place id, then domain, then name and address. A business already present in any earlier search of the project is skipped, and the search records how many were skipped. Running the same search again therefore returns only businesses that are new since the last run, which makes a repeated search a way to pick up newly listed businesses.

Emails are stored as their own rows, one per address found on a lead's site, each with its own check result. One of them is marked as the primary address to write to first.

## Broad searches

A local search does not need a single category. The user can pick a preset sector group, such as health and clinics, legal and finance, or home services, which sends up to ten matching categories in one request, or search every category in the area. A need filter narrows any local search to businesses without a website, with an unclaimed Google profile, or with fewer than ten reviews; these are passed to the provider as listing filters, so only matching businesses are billed.

Online store searches choose a platform (Shopify, WooCommerce, Wix, Squarespace or BigCommerce) and treat niche keywords as optional, so a search can cover every small store of a platform in a country. Only Shopify stores are checked against the storefront's `meta.json`, so unconfirmed sites are hidden only in Shopify searches.

## Automatic runs

Any search except a pasted domain list can run again, either on demand or weekly. Each search stores how far into the provider's ordered results it has read, and a run continues from there, asking for as many rows as it still needs, until it has added the requested number of new leads (ten by default), three calls have been made, or the results run out. When the results run out, the next run starts again from the top, which picks up businesses that were listed since. New leads join the same search and are shown as new in the outreach list.

A separate ten-minute cron runs due searches and, when none ran, reads one small batch of pending leads from searches with weekly runs turned on, so automatic runs fill in without a browser open. It is its own cron trigger so its subrequests do not share an invocation with rank checks. Due searches are claimed by compare-and-set on their next run time, so overlapping ticks cannot run the same search twice. The Docker self-host scheduler only fires the main cron, so automatic runs need the Cloudflare deployment.

## Shopify stores

A store search asks the provider's technology index for domains running Shopify, filtered by country and an optional ceiling on backlink rank so large brands can be left out, and matched against niche keywords in the site's title and description. The provider treats several keywords in one request as all required, so each keyword is sent as its own request with a share of the limit, and the results are merged; any keyword can match. Results are ordered by rank. The index records emails and phone numbers it saw on each site; those emails are saved with the lead and checked alongside the ones the app reads itself. A pasted list skips the lookup entirely and costs nothing.

Stores are identified by domain, so a store already found in any earlier search of the project, local or store, is skipped.

While reading a store, the app also requests the storefront's public `meta.json` and the newest few entries of `products.json`. A valid `meta.json` confirms the site is a live Shopify store and gives its published product count, country and currency; the product entries give the date of the newest product, a simple sign of whether the store is still active. Sites that do not answer as a Shopify store (closed, password protected, moved to another platform, or unreadable) stay in the search but are hidden by default, since the technology index can lag behind such changes. Shopify's default robots.txt disallows `/policies/`, so policy pages are not read; the common contact page paths are tried instead.

## Reading websites

Enrichment reads one small batch of pending leads per call. For each lead it opens the home page and, only when the home page shows no email on the site's own domain, up to three contact pages. Contact pages are found from links whose address or text suggests a contact or about page, in English and Turkish; contact links are read before about links, and when a page links to no contact page, the conventional path for the page's language is tried once. The site's robots.txt is honored. Requests identify themselves as the lead finder with a link to the app rather than imitating a browser; Shopify's bot protection challenged a browser-like agent sent from Workers.

Leads whose site could not be read can be queued again from the search, which sets them back to pending.

Every fetched address is screened for SSRF. The site's start address and each redirect hop are validated as untrusted start URLs; discovered contact links must be same-origin and crawlable. Redirects are followed by hand.

From each page the reader collects mailto links, plain-text addresses, addresses obfuscated with "[at]" and "[dot]", and addresses hidden by Cloudflare's email protection. It discards asset names, tracking ids, template placeholders and no-reply inboxes. It also records the first Instagram profile, Facebook page, LinkedIn page and WhatsApp link it sees. Facebook profiles without a username keep their profile id.

A site that cannot be read (blocked, timed out, or rendered only by JavaScript) is marked as such on the lead, so the user knows to check it by hand rather than assuming it publishes no email.

The app drives enrichment from the browser, one batch per request, while the search is open, and the user can pause it. The MCP surface exposes the same batch as its own tool, which an agent calls until nothing is pending. Small batches keep each request within the platform's per-request subrequest budget.

## Email checks

Each address gets free checks: its syntax, whether its domain publishes mail exchangers, and whether it is a personal address, a shared inbox such as info@, or a free provider address. A domain that does not exist, or exists without mail exchangers, marks the address as unable to receive mail. A failed DNS lookup is treated as unknown and leaves the address usable.

The primary address is the reachable address that best combines being on the site's own domain and belonging to a person. Recruiting and billing inboxes are never chosen first. An address on some other company's domain, often a theme or app vendor whose support address appears in the site's code, ranks below the business's own free-provider inbox.

These checks cannot prove that a mailbox exists or detect catch-all domains. That requires an SMTP conversation on port 25, which Workers cannot open.

## Reachability

Every lead is placed in one group: ready to email, reachable only by phone or social profiles, showing an email whose domain cannot receive mail, no contact found, or not yet read. The groups drive sorting, filters, the export and the MCP summaries, and are computed from stored data on read.

## Opportunity score

While reading a site, the app also audits what a marketer would pitch on. Each finding has a category (local profile, SEO, GEO, content, design, ads and tracking, email, conversion, store, trust) and a severity (critical, important, low), and may carry a short detail such as a theme name, a share of sold-out products or the AI crawlers a robots.txt blocks. Most checks read the home page HTML: indexing, title, headings, image descriptions, canonical and language tags, structured data, tracking and email tools, review and chat widgets, the Shopify theme and footer leftovers, and links to policy, about and social pages. A few cheap extra requests per site cover what the home page can't show: robots.txt rules for AI crawlers, a sitemap, llms.txt, whether plain http redirects, the newest date on the blog and how many posts it had in the last three months, the store's public product feed (sold-out share, empty descriptions, single-photo products, last product added) and one product page's structured data, which is what Google Merchant reads. DNS-over-HTTPS lookups check that a domain receiving mail also publishes SPF and DMARC. Local listings add their own findings from the listing data the search already returned: unclaimed profile, low rating, few reviews, missing hours and few photos.

Some checks only apply where they make sense: store checks run for store searches and for sites detected as Shopify or WooCommerce, booking checks for health, beauty and fitness businesses, the cookie consent check for European domains and stores, and the KVKK notice check for Turkish sites. Each finding is a row of its own, and the opportunity score is a weighted sum by severity, capped at 100, so lists can sort on it. Sites are read two at a time per request because every site now costs more subrequests.

The checks read only the HTML the server returns, so a tag injected later by a script, or by Shopify's sandboxed pixel manager without a visible ID, can read as missing. Findings are therefore presented as gaps that are not visible, and the score ranks leads rather than grading them. A site that could not be read gets no score instead of a perfect one.

## Outreach list

Every lead in a project, across all of its searches, appears in one list sorted by opportunity score, with unscored leads last. The list can be filtered to leads with one specific finding, and a lead's findings open in a side panel grouped by category, with why each one matters and a button that copies them as email-ready bullets in the lead's language. Selected leads can be rescanned, which reads their sites again with the current checks; the browser sends them two at a time so each request stays inside the subrequest budget. Each lead carries an outreach status: new, emailed, replied, not interested or client. Marking a lead as emailed records when it was first emailed. Because leads are deduplicated per project, a lead that was emailed or turned the offer down is never added again by a later search. Deleting a search deletes its leads and their statuses, and the confirmation says how many tracked leads that affects.

## Hiding, notes and reminders

Leads can be hidden from the outreach list in bulk. Hiding keeps the row, so the per-project deduplication still sees the business and no later search adds it again; it can be undone right after. Hidden leads are left out of the outreach list and of the search detail.

Each lead can carry one note: a color dot, free text and an optional reminder date. The note shows under the lead's name in the list. Reminder dates are compared with the viewer's local date, and a reminders filter shows the leads whose date has come.

## First lines

From the outreach list, the user can ask the app to write the first line of a cold email for up to fifty selected leads. Leads go to the project's configured OpenRouter model in batches of twenty-five, each with its name, kind of business, review count, product count and its gaps rewritten as plain facts. The line names one gap and what it costs the business, then offers a free short report of what could be improved; it avoids jargon, never asserts a gap as certain (the checks only see page code), and is written in Turkish for Turkish businesses and English otherwise. The model's spend is metered like other research. Lines are stored on the lead, editable in place, and included in exports.

Templates filled from the gaps would cost nothing, but they read the same across hundreds of emails. A model call per batch keeps the cost to a fraction of a cent per lead.

## Email templates

A project keeps its own email templates, each with a language (Turkish or English), a subject and a body. Templates use a few fields filled from the lead: its name, first line (or a general opener when it has none), website, its biggest gap and its three biggest gaps as a list, phrased for the email's language. Two sample templates can be added and edited; they leave a placeholder for the sender's postal address, which US commercial email law requires.

The email button on a lead with a reachable address picks the templates in the lead's language (Turkish for Turkish businesses), renders one and opens a ready-to-send draft, either in Gmail on the web, in one reusable popup window beside the list, or through a `mailto:` link in the viewer's mail app. The choice is a per-browser preference. The app never sends email itself, so messages go out from the user's own mailbox, and opening a draft marks a new lead as emailed.

Sending directly through a mail provider's API would allow tracking and bulk sends, but it needs OAuth scopes to read and send mail, and bulk cold email from a primary domain hurts deliverability. Drafts keep the user in control of every message; bulk sending is better left to a dedicated tool fed by the export.

## Client reports

A lead with a website can get a client report on demand, built by the maintainer's SEO & GEO Chrome extension rather than by the server: the extension already renders the rendered page's checks, and a Worker cannot run the page's scripts. The app page and the extension talk through `window.postMessage` and a content script the extension injects on the app's origin, which also marks the page with the extension's version so the button can tell whether it is installed. The extension opens the site in a background tab, runs its audit, renders its client report (issues and why they matter, no fixes), and returns the HTML; the app then saves it for that lead.

Reports are stored in R2 with scripts stripped and served at `/audit/<site>-<6 random characters>` (older reports keep their 32-character `/lr/<token>` links) with a sandboxing Content-Security-Policy, `noindex` and no referrer. The random suffix keeps links unguessable while the site name tells the recipient what they're opening. A token only resolves while its lead exists, so deleting the search revokes the link. Each open is counted with its last-open time, skipping the owner's own previews and known link scanners. Self-hosted deployments sit behind Cloudflare Access, so the deploy adds path-scoped Access applications that bypass Access for `/audit` and `/lr` only; everything else stays gated.

Email templates get a `{{report_offer}}` sentence that links the report when it exists and otherwise offers to send one, and a bare `{{report_link}}`. First lines no longer make an offer themselves, so the email does not offer twice.

## Alternatives

Scraping Google Maps directly would avoid the listings provider, but Maps blocks automated access, needs rotating proxies and breaks whenever the page changes. The licensed listings data is stable and already used by the local SEO tools.

A paid verification provider would add mailbox-level checks and catch-all detection. The free checks catch dead domains and typos, which are the most common failures in addresses read from small business sites, without another account or per-address cost. A provider can be added later as an optional step after the free checks.

Finding stores by searching Google for "powered by Shopify" footprints would avoid the technology index, but it bills per results page, returns many non-store pages and gives no country or size filter.

Running enrichment in a background workflow would let large searches finish while no one watches. Browser-driven batches need no new infrastructure, show progress directly, and fit the list sizes this feature targets. Scheduled background runs can be evaluated separately.

Storing found emails as a delimited text column on the lead would avoid a table, but each address carries its own check result and kind, and exports and summaries query them individually.
