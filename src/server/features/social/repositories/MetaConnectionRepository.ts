import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metaConnections } from "@/db/schema";

export type MetaConnection = typeof metaConnections.$inferSelect;

type MetaConnectionInput = Omit<
  MetaConnection,
  "id" | "createdAt" | "updatedAt"
>;

async function getByProjectId(projectId: string) {
  const rows = await db
    .select()
    .from(metaConnections)
    .where(eq(metaConnections.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsert(input: MetaConnectionInput) {
  const now = new Date().toISOString();
  await db
    .insert(metaConnections)
    .values({
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: metaConnections.projectId,
      set: { ...input, updatedAt: now },
    });
}

async function update(projectId: string, values: Partial<MetaConnectionInput>) {
  await db
    .update(metaConnections)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(metaConnections.projectId, projectId));
}

async function deleteByProjectId(projectId: string) {
  await db
    .delete(metaConnections)
    .where(eq(metaConnections.projectId, projectId));
}

export const MetaConnectionRepository = {
  getByProjectId,
  upsert,
  update,
  deleteByProjectId,
};
