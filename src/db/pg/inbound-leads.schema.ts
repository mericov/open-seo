import { sql } from "drizzle-orm";
import { index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import {
  INBOUND_LEAD_STATUSES,
  INBOUND_LEAD_VERDICTS,
} from "@/shared/inboundLeads";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const inboundLeads = pgTable(
  "inbound_leads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    source: text("source"),
    locale: text("locale"),
    page: text("page"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    message: text("message"),
    secondsOnPage: integer("seconds_on_page"),
    verdict: text("verdict", { enum: INBOUND_LEAD_VERDICTS })
      .notNull()
      .default("ok"),
    reason: text("reason"),
    status: text("status", { enum: INBOUND_LEAD_STATUSES })
      .notNull()
      .default("new"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    index("inbound_leads_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);
