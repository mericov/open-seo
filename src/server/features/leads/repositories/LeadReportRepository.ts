import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leads, leadSearches } from "@/db/schema";

async function listForReports(projectId: string, leadIds: string[]) {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      website: leads.website,
      domain: leads.domain,
      countryCode: leads.countryCode,
      enrichmentStatus: leads.enrichmentStatus,
      opportunityScore: leads.opportunityScore,
      locationLabel: leadSearches.locationLabel,
    })
    .from(leads)
    .innerJoin(leadSearches, eq(leadSearches.id, leads.searchId))
    .where(and(eq(leads.projectId, projectId), inArray(leads.id, leadIds)));
}

export const LeadReportRepository = { listForReports };
