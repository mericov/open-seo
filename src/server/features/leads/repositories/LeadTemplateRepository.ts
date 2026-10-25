import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadEmailTemplates } from "@/db/schema";
import type { LeadEmailLanguage } from "@/shared/leadEmail";

type TemplateInput = {
  name: string;
  language: LeadEmailLanguage;
  step: number;
  subject: string;
  body: string;
};

async function list(projectId: string) {
  return db
    .select({
      id: leadEmailTemplates.id,
      name: leadEmailTemplates.name,
      language: leadEmailTemplates.language,
      step: leadEmailTemplates.step,
      subject: leadEmailTemplates.subject,
      body: leadEmailTemplates.body,
    })
    .from(leadEmailTemplates)
    .where(eq(leadEmailTemplates.projectId, projectId))
    .orderBy(
      asc(leadEmailTemplates.step),
      asc(leadEmailTemplates.createdAt),
      asc(leadEmailTemplates.name),
    );
}

async function create(projectId: string, input: TemplateInput) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .insert(leadEmailTemplates)
    .values({ id, projectId, ...input, createdAt: now, updatedAt: now });
  return id;
}

async function update(projectId: string, id: string, input: TemplateInput) {
  await db
    .update(leadEmailTemplates)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(leadEmailTemplates.projectId, projectId),
        eq(leadEmailTemplates.id, id),
      ),
    );
}

async function remove(projectId: string, id: string) {
  await db
    .delete(leadEmailTemplates)
    .where(
      and(
        eq(leadEmailTemplates.projectId, projectId),
        eq(leadEmailTemplates.id, id),
      ),
    );
}

export const LeadTemplateRepository = { list, create, update, remove };
