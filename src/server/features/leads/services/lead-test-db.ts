import { readFileSync } from "node:fs";
import type { runBatch } from "@/db/runBatch";

const LEAD_MIGRATIONS = [
  "0058_lead_finder.sql",
  "0059_lead_finder_stores.sql",
  "0060_lead_outreach.sql",
  "0061_lead_scans.sql",
  "0062_lead_first_line.sql",
  "0063_lead_email_templates.sql",
  "0064_lead_notes_reports.sql",
  "0065_lead_findings_detail.sql",
  "0067_lead_report_views.sql",
  "0069_lead_campaigns.sql",
  "0070_lead_follow_ups.sql",
];

// The lead tables as the real migrations build them, on top of the two parent
// tables they reference, for tests that run queries against in-memory SQLite.
export function leadSchemaStatements() {
  return [
    `CREATE TABLE organization (id text PRIMARY KEY);`,
    `INSERT INTO organization (id) VALUES ('o1'), ('o2');`,
    `CREATE TABLE projects (id text PRIMARY KEY, organization_id text, archived_at text);`,
    `INSERT INTO projects (id, organization_id) VALUES ('p1', 'o1'), ('p2', 'o1'), ('p3', 'o2');`,
    ...LEAD_MIGRATIONS.flatMap((file) =>
      readFileSync(`drizzle/sqlite/${file}`, "utf8").split(
        "--> statement-breakpoint",
      ),
    ),
  ];
}

type Executor = Parameters<Parameters<typeof runBatch>[0]>[0];

// Runs the production batch statements one by one on the test database.
export function sequentialBatches(testDb: unknown) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the libsql Drizzle client has the same query-builder surface as the D1 executor
  const executor = testDb as Executor;
  return {
    runBatch: async (build: Parameters<typeof runBatch>[0]) => {
      for (const statement of build(executor)) await statement;
    },
    executeInBatches: async <T>(
      items: T[],
      build: (tx: Executor, item: T) => Promise<unknown>,
    ) => {
      for (const item of items) await build(executor, item);
    },
  };
}
