import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  adDraftMedia,
  adDraftVariations,
  adDrafts,
  socialMediaAssets,
} from "@/db/schema";
import type { AD_VARIATION_FIELDS } from "@/shared/social";

export type AdDraft = typeof adDrafts.$inferSelect;
type AdDraftInsert = typeof adDrafts.$inferInsert;
type VariationField = (typeof AD_VARIATION_FIELDS)[number];
type Variation = { field: VariationField; value: string };

function childStatements(
  tx: Parameters<Parameters<typeof runBatch>[0]>[0],
  draftId: string,
  variations: Variation[],
  assetIds: string[],
) {
  const positions = new Map<string, number>();
  return [
    ...(variations.length > 0
      ? [
          tx.insert(adDraftVariations).values(
            variations.map((variation) => {
              const position = positions.get(variation.field) ?? 0;
              positions.set(variation.field, position + 1);
              return {
                id: crypto.randomUUID(),
                draftId,
                field: variation.field,
                position,
                value: variation.value,
              };
            }),
          ),
        ]
      : []),
    ...(assetIds.length > 0
      ? [
          tx.insert(adDraftMedia).values(
            assetIds.map((assetId, position) => ({
              draftId,
              assetId,
              position,
            })),
          ),
        ]
      : []),
  ];
}

async function create(
  values: AdDraftInsert,
  variations: Variation[],
  assetIds: string[],
) {
  await runBatch((tx) => [
    tx.insert(adDrafts).values(values),
    ...childStatements(tx, values.id, variations, assetIds),
  ]);
}

async function replace(
  projectId: string,
  id: string,
  values: Partial<AdDraftInsert>,
  variations: Variation[],
  assetIds: string[],
) {
  await runBatch((tx) => [
    tx
      .update(adDrafts)
      .set({ ...values, updatedAt: new Date().toISOString() })
      .where(and(eq(adDrafts.projectId, projectId), eq(adDrafts.id, id))),
    tx.delete(adDraftVariations).where(eq(adDraftVariations.draftId, id)),
    tx.delete(adDraftMedia).where(eq(adDraftMedia.draftId, id)),
    ...childStatements(tx, id, variations, assetIds),
  ]);
}

async function update(
  projectId: string,
  id: string,
  values: Partial<AdDraftInsert>,
) {
  await db
    .update(adDrafts)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(and(eq(adDrafts.projectId, projectId), eq(adDrafts.id, id)));
}

async function get(projectId: string, id: string) {
  const rows = await db
    .select()
    .from(adDrafts)
    .where(and(eq(adDrafts.projectId, projectId), eq(adDrafts.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

async function list(projectId: string, limit: number) {
  return db
    .select()
    .from(adDrafts)
    .where(eq(adDrafts.projectId, projectId))
    .orderBy(desc(adDrafts.updatedAt))
    .limit(limit);
}

async function listChildren(draftIds: string[]) {
  if (draftIds.length === 0) return { variations: [], media: [] };
  const [variations, media] = await Promise.all([
    db
      .select()
      .from(adDraftVariations)
      .where(inArray(adDraftVariations.draftId, draftIds))
      .orderBy(asc(adDraftVariations.field), asc(adDraftVariations.position)),
    db
      .select({
        draftId: adDraftMedia.draftId,
        position: adDraftMedia.position,
        asset: socialMediaAssets,
      })
      .from(adDraftMedia)
      .innerJoin(
        socialMediaAssets,
        eq(socialMediaAssets.id, adDraftMedia.assetId),
      )
      .where(inArray(adDraftMedia.draftId, draftIds))
      .orderBy(asc(adDraftMedia.position)),
  ]);
  return { variations, media };
}

async function remove(projectId: string, id: string) {
  await db
    .delete(adDrafts)
    .where(and(eq(adDrafts.projectId, projectId), eq(adDrafts.id, id)));
}

export const AdDraftRepository = {
  create,
  replace,
  update,
  get,
  list,
  listChildren,
  remove,
};
