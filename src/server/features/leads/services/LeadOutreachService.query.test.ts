import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type * as LeadOutreachServiceModule from "./LeadOutreachService";

// Real in-memory SQLite: the list ordering, primary-email join and status
// counts are the contract, and a mocked builder chain can't run them.

vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
}));

let client: Client;
let LeadOutreachService: typeof LeadOutreachServiceModule.LeadOutreachService;

const migration = (file: string) =>
  readFileSync(`drizzle/sqlite/${file}`, "utf8").split(
    "--> statement-breakpoint",
  );

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  vi.doMock("@/db", () => ({ db: drizzle(client) }));
  await client.executeMultiple(
    [
      `CREATE TABLE projects (id text PRIMARY KEY);`,
      `INSERT INTO projects (id) VALUES ('p1'), ('p2');`,
      ...migration("0058_lead_finder.sql"),
      ...migration("0059_lead_finder_stores.sql"),
      ...migration("0060_lead_outreach.sql"),
      `INSERT INTO lead_searches (id, project_id, label, source, category, location_label, latitude, longitude, radius_km, requested_limit)
        VALUES ('s1', 'p1', 'Florists', 'local', 'florist', 'Austin', 0, 0, 10, 10),
               ('s2', 'p1', 'Stores', 'shopify', 'shopify', '', 0, 0, 0, 10),
               ('s3', 'p2', 'Other', 'local', 'florist', 'Austin', 0, 0, 10, 10);`,
      `INSERT INTO leads (id, project_id, search_id, business_key, name, opportunity_score)
        VALUES ('a', 'p1', 's1', 'k-a', 'Unscored', NULL),
               ('b', 'p1', 's1', 'k-b', 'Low', 20),
               ('c', 'p1', 's2', 'k-c', 'High', 80),
               ('x', 'p2', 's3', 'k-x', 'Other project', 99);`,
      `INSERT INTO lead_emails (id, lead_id, email, check_status, kind, is_primary)
        VALUES ('e1', 'c', 'hi@high.test', 'mx_ok', 'role', 1),
               ('e2', 'b', 'spare@low.test', 'mx_ok', 'role', 0);`,
      `INSERT INTO lead_findings (id, lead_id, code) VALUES ('f1', 'c', 'no_blog'), ('f2', 'c', 'no_analytics');`,
    ].join("\n"),
  );
  ({ LeadOutreachService } = await import("./LeadOutreachService"));
});

afterAll(() => {
  client.close();
});

const page = { page: 1, pageSize: 50 };

it("lists a project's leads by score with unscored last, and tracks outreach", async () => {
  const all = await LeadOutreachService.listLeads("p1", {}, page);
  expect(all.leads.map((lead) => lead.name)).toEqual([
    "High",
    "Low",
    "Unscored",
  ]);
  expect(all.leads[0]).toMatchObject({
    primaryEmail: "hi@high.test",
    searchLabel: "Stores",
    findings: ["no_analytics", "no_blog"],
  });

  await LeadOutreachService.setStatus("p1", ["c", "x"], "contacted");

  const contacted = await LeadOutreachService.listLeads(
    "p1",
    { status: "contacted", hasEmail: true },
    page,
  );
  expect(contacted.leads.map((lead) => lead.id)).toEqual(["c"]);
  expect(contacted.leads[0].contactedAt).toEqual(expect.any(String));
  expect(contacted.counts).toMatchObject({ all: 1, contacted: 1, new: 0 });

  const other = await LeadOutreachService.listLeads("p2", {}, page);
  expect(other.leads[0].outreachStatus).toBe("new");
});
