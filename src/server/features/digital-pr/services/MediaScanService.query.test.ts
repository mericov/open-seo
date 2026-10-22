import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type * as MediaScanServiceModule from "./MediaScanService";

vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
}));

const mocks = vi.hoisted(() => ({
  news: vi.fn(),
  live: vi.fn(),
  bulkTraffic: vi.fn(),
}));

vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({
    serp: { news: mocks.news, live: mocks.live },
    domain: { bulkTraffic: mocks.bulkTraffic },
  }),
}));

let client: Client;
let MediaScanService: typeof MediaScanServiceModule.MediaScanService;

const billing = { organizationId: "org", userId: "u", userEmail: "u@x.test" };

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  vi.doMock("@/db", () => ({ db: testDb }));
  vi.doMock("@/db/runBatch", () => ({
    executeInBatches: async <T>(
      items: T[],
      build: (tx: typeof testDb, item: T) => Promise<unknown>,
    ) => {
      for (const item of items) await build(testDb, item);
    },
  }));
  await client.executeMultiple(
    [
      `CREATE TABLE organization (id text PRIMARY KEY);`,
      `CREATE TABLE projects (id text PRIMARY KEY);`,
      `INSERT INTO organization (id) VALUES ('org');`,
      ...readFileSync("drizzle/sqlite/0066_digital_pr.sql", "utf8").split(
        "--> statement-breakpoint",
      ),
      `INSERT INTO media_topics (id, organization_id, keyword, market) VALUES ('t1', 'org', 'çiçek', 'tr');`,
    ].join("\n"),
  );
  ({ MediaScanService } = await import("./MediaScanService"));
});

beforeEach(() => {
  mocks.news.mockResolvedValue([
    {
      type: "news_search",
      domain: "www.haber.com.tr",
      url: "https://www.haber.com.tr/a",
      source: "Haber",
      title: "A",
      timestamp: "2026-10-20 08:00:00 +00:00",
    },
  ]);
  mocks.live.mockResolvedValue([
    {
      type: "organic",
      domain: "blog.test",
      url: "https://blog.test/post",
      title: "Post",
    },
  ]);
  mocks.bulkTraffic.mockResolvedValue([
    { target: "haber.com.tr", etv: 1234.4 },
  ]);
});

afterAll(() => {
  client.close();
});

it("repeated scans add each outlet and article once and keep a person's edits", async () => {
  const first = await MediaScanService.runScan("org", "manual", billing);
  expect(first).toMatchObject({ outletsAdded: 2, articlesAdded: 2 });

  await client.execute(
    `UPDATE media_outlets SET name = 'Benim adım', edited_at = '2026-10-21' WHERE domain = 'haber.com.tr'`,
  );
  const second = await MediaScanService.runScan("org", "weekly", billing);
  expect(second).toMatchObject({
    outletsFound: 2,
    outletsAdded: 0,
    articlesAdded: 0,
  });

  const outlets = await client.execute(
    `SELECT domain, name, organic_traffic FROM media_outlets ORDER BY domain`,
  );
  expect(outlets.rows.map((row) => ({ ...row }))).toEqual([
    { domain: "blog.test", name: null, organic_traffic: null },
    { domain: "haber.com.tr", name: "Benim adım", organic_traffic: 1234 },
  ]);
});

it("refuses a second scan while one holds the lock", async () => {
  await client.execute(
    `UPDATE media_scan_settings SET running_run_id = 'other', run_started_at = '${new Date().toISOString()}' WHERE organization_id = 'org'`,
  );
  await expect(
    MediaScanService.runScan("org", "manual", billing),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
