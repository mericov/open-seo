import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prEmailTemplates } from "@/db/schema";
import type { PrLanguage } from "@/shared/digitalPr";

async function listTemplates(projectId: string) {
  return db
    .select()
    .from(prEmailTemplates)
    .where(eq(prEmailTemplates.projectId, projectId))
    .orderBy(prEmailTemplates.language, prEmailTemplates.name);
}

async function saveTemplate(
  projectId: string,
  templateId: string | undefined,
  values: { name: string; language: PrLanguage; subject: string; body: string },
) {
  const now = new Date().toISOString();
  if (templateId) {
    await db
      .update(prEmailTemplates)
      .set({ ...values, updatedAt: now })
      .where(
        and(
          eq(prEmailTemplates.projectId, projectId),
          eq(prEmailTemplates.id, templateId),
        ),
      );
    return templateId;
  }
  const id = crypto.randomUUID();
  await db.insert(prEmailTemplates).values({
    id,
    projectId,
    ...values,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function deleteTemplate(projectId: string, templateId: string) {
  await db
    .delete(prEmailTemplates)
    .where(
      and(
        eq(prEmailTemplates.projectId, projectId),
        eq(prEmailTemplates.id, templateId),
      ),
    );
}

export const PrTemplateRepository = {
  listTemplates,
  saveTemplate,
  deleteTemplate,
};
