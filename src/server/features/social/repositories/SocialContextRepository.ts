import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  aiMatches,
  aiObservations,
  aiPrompts,
  aiRuns,
  aiTrackers,
} from "@/db/schema";

async function listAiPrompts(projectId: string, limit: number) {
  return db
    .select({ text: aiPrompts.text, topic: aiPrompts.topic })
    .from(aiPrompts)
    .innerJoin(aiTrackers, eq(aiTrackers.id, aiPrompts.trackerId))
    .where(
      and(
        eq(aiTrackers.projectId, projectId),
        eq(aiPrompts.archived, false),
        eq(aiPrompts.paused, false),
      ),
    )
    .limit(limit);
}

async function latestAiRunVisibility(projectId: string) {
  const runs = await db
    .select({ id: aiRuns.id, completedAt: aiRuns.completedAt })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.projectId, projectId),
        inArray(aiRuns.status, ["completed", "partial"]),
      ),
    )
    .orderBy(desc(aiRuns.createdAt))
    .limit(1);
  const run = runs[0];
  if (!run) return null;
  const rows = await db
    .select({
      observationId: aiObservations.id,
      mentioned: aiMatches.mentioned,
      cited: aiMatches.cited,
      own: aiMatches.own,
    })
    .from(aiObservations)
    .leftJoin(aiMatches, eq(aiMatches.observationId, aiObservations.id))
    .where(
      and(
        eq(aiObservations.runId, run.id),
        eq(aiObservations.status, "completed"),
      ),
    );
  const answers = new Set(rows.map((row) => row.observationId));
  const mentioned = new Set(
    rows
      .filter((row) => row.own && (row.mentioned || row.cited))
      .map((row) => row.observationId),
  );
  return {
    checkedAt: run.completedAt,
    answers: answers.size,
    brandMentioned: mentioned.size,
  };
}

export const SocialContextRepository = {
  listAiPrompts,
  latestAiRunVisibility,
};
