import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { leadSchemaStatements, sequentialBatches } from "./lead-test-db";
import type * as LeadScanServiceModule from "./LeadScanService";

// Real in-memory SQLite: which leads a campaign inserts, links or skips is
// decided by the queries themselves.

const businessListings = vi.fn();

vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
}));
vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({ business: { businessListings } }),
}));
vi.mock("@/server/features/leads/services/LeadFinderService", () => ({
  LeadFinderService: {},
}));

let client: Client;
let LeadScanService: typeof LeadScanServiceModule.LeadScanService;

const listing = (domain: string) => ({
  title: domain,
  cid: `cid-${domain}`,
  domain,
});

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  vi.doMock("@/db", () => ({ db: testDb }));
  vi.doMock("@/db/runBatch", () => sequentialBatches(testDb));
  await client.executeMultiple(
    [
      ...leadSchemaStatements(),
      `INSERT INTO lead_searches (id, project_id, label, source, category, location_label, latitude, longitude, radius_km, requested_limit)
        VALUES ('old', 'p1', 'Austin designers', 'local', 'interior_designer', 'Austin', 0, 0, 10, 10);`,
      `INSERT INTO lead_searches (id, project_id, label, source, category, category_group, preset, scope, country_code, location_label, latitude, longitude, radius_km, requested_limit, run_size)
        VALUES ('b2b', 'p1', 'B2B buyers · United States', 'local', 'product_b2b', 'product_b2b', 'product_b2b', 'country', 'US', 'United States', 0, 0, 0, 5, 5);`,
      `INSERT INTO leads (id, project_id, search_id, business_key, name, domain, outreach_status)
        VALUES ('known', 'p1', 'old', 'domain:known.com', 'Known', 'known.com', 'contacted');`,
      `INSERT INTO lead_search_leads (id, search_id, lead_id) VALUES ('l1', 'old', 'known');`,
      `INSERT INTO contact_registry (id, organization_id, contact_key, suppressed_at)
        VALUES ('r1', 'o1', 'blocked.com', '2026-10-01');`,
    ].join("\n"),
  );
  ({ LeadScanService } = await import("./LeadScanService"));
});

afterAll(() => {
  client.close();
});

it("walks the country's metro areas, links leads the project already has and skips blocked domains", async () => {
  businessListings
    .mockResolvedValueOnce([
      listing("www.known.com"),
      listing("blocked.com"),
      listing("new-1.com"),
    ])
    .mockResolvedValueOnce(
      Array.from({ length: 8 }, (_, i) => listing(`la-${i}.com`)),
    );

  const result = await LeadScanService.runNow("p1", "b2b", {
    organizationId: "o1",
  } as never);

  expect(businessListings.mock.calls.map(([input]) => input)).toEqual([
    expect.objectContaining({
      categories: expect.arrayContaining(["home_staging_service"]),
      locationCoordinate: "40.7128,-74.006,50",
      limit: 10,
    }),
    expect.objectContaining({
      locationCoordinate: "34.0522,-118.2437,50",
      limit: 8,
    }),
  ]);
  expect(result).toMatchObject({ added: 9, target: 5 });

  const leads = await client.execute(
    `SELECT domain FROM leads WHERE project_id = 'p1' ORDER BY domain`,
  );
  expect(leads.rows.map((row) => row.domain)).not.toContain("blocked.com");
  expect(leads.rows.filter((row) => row.domain === "known.com")).toHaveLength(
    1,
  );
  const linked = await client.execute(
    `SELECT count(*) AS total FROM lead_search_leads WHERE search_id = 'b2b'`,
  );
  expect(linked.rows[0]?.total).toBe(10);
  const areas = await client.execute(
    `SELECT area_code, next_offset, exhausted_at IS NOT NULL AS exhausted FROM lead_search_areas ORDER BY area_code`,
  );
  expect(areas.rows).toEqual([
    expect.objectContaining({
      area_code: "us-los-angeles",
      next_offset: 8,
      exhausted: 0,
    }),
    expect.objectContaining({
      area_code: "us-new-york",
      next_offset: 0,
      exhausted: 1,
    }),
  ]);
});
