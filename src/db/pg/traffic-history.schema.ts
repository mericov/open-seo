import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
} from "drizzle-orm/pg-core";
import { organization } from "./better-auth-schema";
import { TRAFFIC_KINDS, TRAFFIC_POSITION_BANDS } from "@/shared/trafficHistory";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const trafficHistoryFetches = pgTable(
  "traffic_history_fetches",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    coveredFrom: text("covered_from").notNull(),
    lastFetchedAt: text("last_fetched_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.organizationId,
        table.domain,
        table.locationCode,
        table.languageCode,
      ],
    }),
  ],
);

export const trafficHistoryMonths = pgTable(
  "traffic_history_months",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    month: text("month").notNull(),
    organicTraffic: real("organic_traffic"),
    organicKeywords: integer("organic_keywords"),
    organicTrafficCost: real("organic_traffic_cost"),
    paidTraffic: real("paid_traffic"),
    paidKeywords: integer("paid_keywords"),
    paidTrafficCost: real("paid_traffic_cost"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.organizationId,
        table.domain,
        table.locationCode,
        table.languageCode,
        table.month,
      ],
    }),
  ],
);

export const trafficHistoryPositions = pgTable(
  "traffic_history_positions",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    month: text("month").notNull(),
    kind: text("kind", { enum: TRAFFIC_KINDS }).notNull(),
    band: text("band", { enum: TRAFFIC_POSITION_BANDS }).notNull(),
    keywords: integer("keywords").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.organizationId,
        table.domain,
        table.locationCode,
        table.languageCode,
        table.month,
        table.kind,
        table.band,
      ],
    }),
  ],
);

export const trafficDomainSnapshots = pgTable(
  "traffic_domain_snapshots",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    countriesFetchedAt: text("countries_fetched_at"),
    backlinks: integer("backlinks"),
    referringDomains: integer("referring_domains"),
    domainRank: integer("domain_rank"),
    backlinksFetchedAt: text("backlinks_fetched_at"),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.domain] })],
);

export const trafficCountryShares = pgTable(
  "traffic_country_shares",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    organicTraffic: real("organic_traffic"),
    organicKeywords: integer("organic_keywords"),
    paidTraffic: real("paid_traffic"),
    paidKeywords: integer("paid_keywords"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.organizationId,
        table.domain,
        table.locationCode,
        table.languageCode,
      ],
    }),
  ],
);

export const trafficHistoryNotes = pgTable(
  "traffic_history_notes",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    month: text("month").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    index("traffic_history_notes_org_domain_idx").on(
      table.organizationId,
      table.domain,
    ),
  ],
);
