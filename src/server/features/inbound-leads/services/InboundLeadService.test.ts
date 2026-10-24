import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type * as InboundLeadServiceModule from "./InboundLeadService";

vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
}));

vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async () => "s3cret",
}));

let client: Client;
let InboundLeadService: typeof InboundLeadServiceModule.InboundLeadService;

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  // Real SQL needs the module-level db swapped before the service loads.
  vi.doMock("@/db", () => ({ db: drizzle(client) }));
  await client.executeMultiple(
    [
      `CREATE TABLE projects (id text PRIMARY KEY, domain text, language_code text NOT NULL, archived_at text, created_at text NOT NULL);`,
      `INSERT INTO projects VALUES ('en', 'mericozyon.com', 'en', NULL, '2026-01-01');`,
      `INSERT INTO projects VALUES ('tr', 'mericozyon.com', 'tr', NULL, '2026-01-02');`,
      ...readFileSync("drizzle/sqlite/0068_inbound_leads.sql", "utf8").split(
        "--> statement-breakpoint",
      ),
    ].join("\n"),
  );
  ({ InboundLeadService } = await import("./InboundLeadService"));
});

afterAll(() => {
  client.close();
});

const post = (token: string, body: unknown) =>
  InboundLeadService.handleIngest(
    new Request("https://seo.test/api/inbound-leads", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );

const lead = {
  domain: "mericozyon.com",
  locale: "tr",
  email: "ayse@example.com",
  verdict: "ok",
};

it("rejects a request with the wrong secret and stores nothing", async () => {
  const response = await post("wrong", lead);
  expect(response.status).toBe(401);
  const rows = await client.execute("SELECT count(*) AS n FROM inbound_leads");
  expect(rows.rows[0]?.n).toBe(0);
});

it("files the lead under the project whose language matches the form", async () => {
  const response = await post("s3cret", lead);
  expect(await response.json()).toMatchObject({ ok: true, projectId: "tr" });
});
