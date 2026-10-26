# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@../AGENTS.md

## Commands

pnpm is pinned via `packageManager` (`corepack enable`, then `pnpm install --frozen-lockfile`). Local setup: copy `.env.example` to `.env.local`, set `DATAFORSEO_API_KEY` (base64 `login:password`) and `AUTH_MODE=local_noauth`, then `pnpm db:migrate:local` once per fresh D1 database.

- Dev server: `pnpm dev:agents` (portless at `http://open-seo.localhost:1355`, worktrees get a branch prefix; logs tee to `.logs/dev-server.log`, read that file when debugging). Plain `pnpm dev` also works.
- Unit tests: `pnpm test` (Vitest, `src/**/*.test.ts` and `scripts/**/*.test.ts`). Single file: `pnpm vitest run src/server/mcp/table.test.ts`; single test: add `-t "name"`.
- E2E: `pnpm test:e2e` (Playwright, `tests/playwright.config.ts`).
- Lint / types / format: `pnpm lint`, `pnpm types:check`, `pnpm format:write`.
- Unused exports/deps: `pnpm knip` (CI fails on exports only used by tests).
- Everything CI checks: `pnpm ci:check` (prettier, knip, tsc incl. `tests/badseo`, oxlint, and that `plugins/openseo/skills` is in sync with `pnpm sync-plugin-skills`).
- Migrations: edit both dialect schemas, then `pnpm db:generate` (writes `drizzle/sqlite` and `drizzle/pg`). Better Auth schema is generated with `pnpm auth:generate`.
- Worker binding types: `pnpm cf-typegen` after changing `wrangler*.jsonc`.

`web/` (marketing site + public docs) and `tests/badseo/` (audit fixture site) are separate pnpm projects with their own lockfiles; run them with `pnpm --dir web ...` / `pnpm --dir tests/badseo ...`. See `docs/LOCAL_DEVELOPMENT.md`.

## Architecture

TanStack Start (React 19) app running on Cloudflare Workers. `vite.config.ts` drops the Cloudflare/Start plugins in test mode, so unit tests run in plain Node with only the `@/` path alias.

**Request flow.** `src/server.ts` is the worker entry: it routes MCP traffic through the OAuth provider (`src/server/mcp/oauth-provider.ts`), Agents SDK requests (SAM chat Durable Object), webhooks, and everything else to the TanStack Start handler. It also owns the cron `scheduled` jobs (rank checks, stale-audit reconciliation, etc.). File-based routes live in `src/routes/` (`routeTree.gen.ts` is generated).

**Backend layering.** `src/serverFunctions/*.ts` (`createServerFn` + Zod validator from `src/types/schemas/` + middleware such as `requireProjectContext`) → `src/server/features/<feature>/services/` → `src/server/features/<feature>/repositories/`. MCP tools in `src/server/mcp/tools/` call the same services; each is registered through `instrumentMcpToolHandler` and wrapped in project auth. Code shared by client and server goes in `src/shared/`; client UI is in `src/client/features/<feature>/`.

**Database.** `src/db/index.ts` exports one `db` that is D1 (SQLite, default) or Postgres via Hyperdrive when `DATABASE_PROVIDER=postgres`. Every table exists twice: `src/db/*.schema.ts` (SQLite) and `src/db/pg/*.schema.ts`, kept structurally identical by `src/db/schema-parity.test.ts`. `db` is typed as the D1 client; Postgres has no `.batch`, so atomic multi-statement writes go through `runBatch`.

**Workflows and workers.** Long jobs are Cloudflare Workflows in `src/server/workflows/` (rank checks, AI visibility, site audit). The site audit runs in a separate worker, `open-seo-audit` (`src/audit-worker.ts`, `wrangler.audit.jsonc`), for memory isolation; the app reaches it via the `SITE_AUDIT_WORKFLOW` and `AUDIT_ENGINE` bindings. `vite-plugin-lean-worker-bundle.ts` asserts at build time that heavy modules stay lazy in that worker.

**Auth modes** (`src/lib/auth-mode.ts`): `hosted` (Better Auth + organizations + Autumn credit billing), `cloudflare_access` (JWT from Access), `local_noauth` (trusted local only). Self-hosted modes use the operator's DataForSEO key and skip billing.

**DataForSEO and billing.** Provider calls go through `src/server/lib/dataforseo/`. In hosted mode every billable call needs an organization credit check before and metered spend after (see the billing sections of `docs/maintainers/review-guidelines.md`, which also covers tenant scoping and SSRF rules; read it before touching auth, billing, persistence, or MCP).

**Plugin and skills.** Product skills live in `.agents/skills/` (canonical); `.claude/skills/` holds symlinks to the internal repo skills. `plugins/openseo/` is the shipped plugin, with skills copied in by `pnpm sync-plugin-skills`. Use the `create-repo-skill` skill when adding one.

**i18n.** UI strings are in `src/locales/<lang>/` (en, tr); `src/locales/locales.test.ts` checks the locales stay consistent.

## MericSEO kuralları

- Bu repo every-app/open-seo'nun fork'u, adı MericSEO, canlı adres seo.mericozyon.com.
- Self-host: Cloudflare, `AUTH_MODE=cloudflare_access`, env dosyası `.env.selfhost`, deploy komutu `pnpm deploy:selfhost`.
- `.env.selfhost` içindeki değerleri asla ekrana yazdırma veya commit etme.
- Arayüz iki dilli (en, tr). Türkçe doğal olmalı, birebir çeviri değil. SEO terimleri (keyword, backlink, audit, SERP vb.) İngilizce kalır. Her yeni UI metni iki dile de eklenir.
- MericSEO'ya özel bölümler: lead finder, Digital PR (tüm projelerde ortak medya havuzu, her proje kendi PR listesini seçer), Claude ile blog yazma akışı + Higgsfield thumbnail adımı, Google Search Console ve GA4 bağlantıları, cold email takip mailleri.
- Kullanıcı kod bilmiyor: yaptığın değişikliği sonunda Türkçe ve kısa anlat, teknik jargonu azalt.
- Kod içine yorum satırı yazma.
- Belirsiz bir gereksinim varsa koda başlamadan önce sor.
- Upstream ile ileride birleştirmeyi zorlaştırmamak için mevcut OpenSEO dosyalarında gereksiz değişiklik yapma, yeni özellikleri mümkün olduğunca kendi klasörlerinde tut.
