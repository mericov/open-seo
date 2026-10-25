import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches } from "@/db/runBatch";
import { contactRegistry } from "@/db/schema";

const KEY_CHUNK = 90;

async function listByKeys(organizationId: string, keys: string[]) {
  const unique = [...new Set(keys)];
  const rows: (typeof contactRegistry.$inferSelect)[] = [];
  for (let i = 0; i < unique.length; i += KEY_CHUNK) {
    rows.push(
      ...(await db
        .select()
        .from(contactRegistry)
        .where(
          and(
            eq(contactRegistry.organizationId, organizationId),
            inArray(contactRegistry.contactKey, unique.slice(i, i + KEY_CHUNK)),
          ),
        )),
    );
  }
  return rows;
}

async function recordContacts(
  organizationId: string,
  projectId: string,
  keys: string[],
) {
  const now = new Date().toISOString();
  await executeInBatches([...new Set(keys)], (tx, contactKey) =>
    tx
      .insert(contactRegistry)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        contactKey,
        lastContactedAt: now,
        lastProjectId: projectId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [contactRegistry.organizationId, contactRegistry.contactKey],
        set: { lastContactedAt: now, lastProjectId: projectId, updatedAt: now },
      }),
  );
}

async function suppress(
  organizationId: string,
  projectId: string,
  keys: string[],
) {
  const now = new Date().toISOString();
  await executeInBatches([...new Set(keys)], (tx, contactKey) =>
    tx
      .insert(contactRegistry)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        contactKey,
        lastProjectId: projectId,
        suppressedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [contactRegistry.organizationId, contactRegistry.contactKey],
        set: { suppressedAt: now, updatedAt: now },
      }),
  );
}

export const ContactRegistryRepository = {
  listByKeys,
  recordContacts,
  suppress,
};
