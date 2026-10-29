import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectBrandKits } from "@/db/schema";

type BrandKit = typeof projectBrandKits.$inferSelect;
type BrandKitValues = Omit<BrandKit, "projectId" | "updatedAt">;

async function get(projectId: string) {
  const rows = await db
    .select()
    .from(projectBrandKits)
    .where(eq(projectBrandKits.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsert(projectId: string, values: BrandKitValues) {
  const updatedAt = new Date().toISOString();
  await db
    .insert(projectBrandKits)
    .values({ projectId, ...values, updatedAt })
    .onConflictDoUpdate({
      target: projectBrandKits.projectId,
      set: { ...values, updatedAt },
    });
}

export const BrandKitRepository = { get, upsert };
