import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadFindingPhrases } from "@/db/schema";
import type { LeadEmailLanguage } from "@/shared/leadEmail";
import type { LeadFindingCode } from "@/shared/leadFindings";

async function list(projectId: string) {
  return db
    .select({
      code: leadFindingPhrases.code,
      language: leadFindingPhrases.language,
      text: leadFindingPhrases.text,
    })
    .from(leadFindingPhrases)
    .where(eq(leadFindingPhrases.projectId, projectId));
}

async function save(
  projectId: string,
  input: { code: LeadFindingCode; language: LeadEmailLanguage; text: string },
) {
  const now = new Date().toISOString();
  await db
    .insert(leadFindingPhrases)
    .values({
      id: crypto.randomUUID(),
      projectId,
      ...input,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        leadFindingPhrases.projectId,
        leadFindingPhrases.code,
        leadFindingPhrases.language,
      ],
      set: { text: input.text, updatedAt: now },
    });
}

async function remove(
  projectId: string,
  code: LeadFindingCode,
  language: LeadEmailLanguage,
) {
  await db
    .delete(leadFindingPhrases)
    .where(
      and(
        eq(leadFindingPhrases.projectId, projectId),
        eq(leadFindingPhrases.code, code),
        eq(leadFindingPhrases.language, language),
      ),
    );
}

export const LeadPhraseRepository = { list, save, remove };
