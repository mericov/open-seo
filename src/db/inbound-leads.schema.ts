import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";
import {
  INBOUND_LEAD_STATUSES,
  INBOUND_LEAD_VERDICTS,
} from "@/shared/inboundLeads";

export const inboundLeads = sqliteTable(
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("inbound_leads_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);
