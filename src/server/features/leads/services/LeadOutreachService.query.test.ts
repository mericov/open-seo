import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { leadSchemaStatements, sequentialBatches } from "./lead-test-db";
import type * as LeadOutreachServiceModule from "./LeadOutreachService";

// Real in-memory SQLite: the list ordering, primary-email join and status
// counts are the contract, and a mocked builder chain can't run them.

vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
}));

let client: Client;
let LeadOutreachService: typeof LeadOutreachServiceModule.LeadOutreachService;

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  vi.doMock("@/db", () => ({ db: testDb }));
  vi.doMock("@/db/runBatch", () => sequentialBatches(testDb));
  await client.executeMultiple(
    [
      ...leadSchemaStatements(),
      `INSERT INTO lead_searches (id, project_id, label, source, category, location_label, latitude, longitude, radius_km, requested_limit)
        VALUES ('s1', 'p1', 'Florists', 'local', 'florist', 'Austin', 0, 0, 10, 10),
               ('s2', 'p1', 'Stores', 'shopify', 'shopify', '', 0, 0, 0, 10),
               ('s3', 'p2', 'Other', 'local', 'florist', 'Austin', 0, 0, 10, 10);`,
      `INSERT INTO leads (id, project_id, search_id, business_key, name, opportunity_score, domain)
        VALUES ('a', 'p1', 's1', 'k-a', 'Unscored', NULL, NULL),
               ('b', 'p1', 's1', 'k-b', 'Low', 20, NULL),
               ('c', 'p1', 's2', 'k-c', 'High', 80, 'high.test'),
               ('x', 'p2', 's3', 'k-x', 'Other project', 99, 'high.test');`,
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
  const all = await LeadOutreachService.listLeads("p1", "o1", {}, page);
  expect(all.leads.map((lead) => lead.name)).toEqual([
    "High",
    "Low",
    "Unscored",
  ]);
  expect(all.leads[0]).toMatchObject({
    primaryEmail: "hi@high.test",
    searchLabel: "Stores",
    findings: ["no_blog", "no_analytics"],
  });

  await LeadOutreachService.setStatus("p1", "o1", ["c", "x"], "contacted");

  const contacted = await LeadOutreachService.listLeads(
    "p1",
    "o1",
    { status: "contacted", hasEmail: true },
    page,
  );
  expect(contacted.leads.map((lead) => lead.id)).toEqual(["c"]);
  expect(contacted.leads[0].contactedAt).toEqual(expect.any(String));
  expect(contacted.counts).toMatchObject({ all: 1, contacted: 1, new: 0 });

  expect(contacted.leads[0].priorContact).toBeNull();

  const other = await LeadOutreachService.listLeads("p2", "o1", {}, page);
  expect(other.leads[0]).toMatchObject({
    outreachStatus: "new",
    priorContact: { otherProject: true, suppressed: false },
  });
});

it("leaves hidden leads out and finds leads with a reminder due", async () => {
  await LeadOutreachService.setNote("p1", "b", {
    color: "red",
    text: "Call back",
    remindAt: "2026-10-01",
  });
  await LeadOutreachService.setHidden("p1", ["a"], true);

  const due = await LeadOutreachService.listLeads(
    "p1",
    "o1",
    { dueBy: "2026-10-21", today: "2026-10-21" },
    page,
  );
  expect(due.leads.map((lead) => lead.id)).toEqual(["b"]);
  expect(due.leads[0]).toMatchObject({
    noteColor: "red",
    noteText: "Call back",
  });
  expect(due.counts.due).toBe(1);

  const all = await LeadOutreachService.listLeads("p1", "o1", {}, page);
  expect(all.leads.map((lead) => lead.id)).not.toContain("a");
});
