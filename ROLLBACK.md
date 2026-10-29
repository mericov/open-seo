# MericSEO rollback log

Each deploy gets a git tag on the state before it, a full D1 export stored outside the repo, and a D1 Time Travel bookmark taken right before the migration.

Database: `open-seo-db-selfhost` (D1). Live site: https://seo.mericozyon.com

## How to roll back

1. Code: deploy the tag of the last good state.

   ```sh
   git checkout <backup tag>
   pnpm deploy:selfhost --yes
   git checkout main
   ```

2. Database, fastest: restore the Time Travel bookmark taken before the deploy (works for 30 days).

   ```sh
   npx wrangler d1 time-travel restore open-seo-db-selfhost --bookmark=<bookmark>
   ```

3. Database, from the full export (if Time Travel is past 30 days): create an empty database, import the file, then point the app at it or swap names in the Cloudflare dashboard.

   ```sh
   npx wrangler d1 create open-seo-db-restore
   npx wrangler d1 execute open-seo-db-restore --remote --file=<export.sql>
   ```

A migration that only adds tables does not need a database rollback: the old code ignores the new tables.

## Deploys

| Date       | Version | What                                                                                                                                                  | Code backup tag                                  | D1 export                                                             | Time Travel bookmark                                          |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2026-10-29 | 0.1.17  | Phase 1: Social & Ads foundation (Meta connection, brand kit, media store, scheduler, social context). Migration 0075 adds 5 tables, no data changes. | `backup/faz1-20261029-1157` (= `backup/v0.1.16`) | `~/MericSEO-backups/2026-10-29/d1-selfhost-v0.1.16-20261029-1153.sql` | `00001036-00000000-00005113-a1a3d3875ef0e7f56f27dfb4615146c0` |
