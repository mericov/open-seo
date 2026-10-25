import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches } from "@/db/runBatch";
import { leadSearchAreas, leadSearchLeads } from "@/db/schema";

const ID_CHUNK = 90;

async function listAreas(searchId: string) {
  return db
    .select()
    .from(leadSearchAreas)
    .where(eq(leadSearchAreas.searchId, searchId));
}

async function saveArea(
  searchId: string,
  areaCode: string,
  values: { nextOffset: number; exhaustedAt: string | null; lastRunAt: string },
) {
  await db
    .insert(leadSearchAreas)
    .values({ id: crypto.randomUUID(), searchId, areaCode, ...values })
    .onConflictDoUpdate({
      target: [leadSearchAreas.searchId, leadSearchAreas.areaCode],
      set: values,
    });
}

async function resetAreas(searchId: string) {
  await db
    .delete(leadSearchAreas)
    .where(eq(leadSearchAreas.searchId, searchId));
}

async function listLinkedLeadIds(searchId: string, leadIds: string[]) {
  const linked = new Set<string>();
  for (let i = 0; i < leadIds.length; i += ID_CHUNK) {
    const rows = await db
      .select({ leadId: leadSearchLeads.leadId })
      .from(leadSearchLeads)
      .where(
        and(
          eq(leadSearchLeads.searchId, searchId),
          inArray(leadSearchLeads.leadId, leadIds.slice(i, i + ID_CHUNK)),
        ),
      );
    for (const row of rows) linked.add(row.leadId);
  }
  return linked;
}

async function linkLeads(searchId: string, leadIds: string[]) {
  const now = new Date().toISOString();
  await executeInBatches(leadIds, (tx, leadId) =>
    tx
      .insert(leadSearchLeads)
      .values({ id: crypto.randomUUID(), searchId, leadId, createdAt: now })
      .onConflictDoNothing(),
  );
}

// Which leads belong to a campaign, and how far it has read each area.
export const CampaignRepository = {
  listLinkedLeadIds,
  linkLeads,
  listAreas,
  saveArea,
  resetAreas,
};
