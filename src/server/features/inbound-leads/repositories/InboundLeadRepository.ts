import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { inboundLeads, projects } from "@/db/schema";
import type {
  InboundLeadStatus,
  InboundLeadVerdict,
} from "@/shared/inboundLeads";

export type InboundLeadInsert = {
  source: string | null;
  locale: string | null;
  page: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  message: string | null;
  secondsOnPage: number | null;
  verdict: InboundLeadVerdict;
  reason: string | null;
};

async function findProjectsByDomain(domain: string) {
  return db
    .select({
      id: projects.id,
      languageCode: projects.languageCode,
    })
    .from(projects)
    .where(and(eq(projects.domain, domain), isNull(projects.archivedAt)))
    .orderBy(asc(projects.createdAt));
}

async function insert(projectId: string, values: InboundLeadInsert) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(inboundLeads).values({
    id,
    projectId,
    ...values,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function list(
  projectId: string,
  filters: { verdict?: InboundLeadVerdict; status?: InboundLeadStatus },
  page: { limit: number; offset: number },
) {
  const where = and(
    eq(inboundLeads.projectId, projectId),
    filters.verdict ? eq(inboundLeads.verdict, filters.verdict) : undefined,
    filters.status ? eq(inboundLeads.status, filters.status) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(inboundLeads)
      .where(where)
      .orderBy(desc(inboundLeads.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: count() }).from(inboundLeads).where(where),
  ]);
  return { rows, total };
}

async function countByVerdict(projectId: string) {
  return db
    .select({ verdict: inboundLeads.verdict, total: count() })
    .from(inboundLeads)
    .where(eq(inboundLeads.projectId, projectId))
    .groupBy(inboundLeads.verdict);
}

async function countNew(projectId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(inboundLeads)
    .where(
      and(
        eq(inboundLeads.projectId, projectId),
        eq(inboundLeads.status, "new"),
        inArray(inboundLeads.verdict, ["ok", "suspicious"]),
      ),
    );
  return total;
}

async function update(
  projectId: string,
  ids: string[],
  values: {
    status?: InboundLeadStatus;
    verdict?: InboundLeadVerdict;
    note?: string | null;
  },
) {
  const result = await db
    .update(inboundLeads)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(
      and(eq(inboundLeads.projectId, projectId), inArray(inboundLeads.id, ids)),
    )
    .returning({ id: inboundLeads.id });
  return result.length;
}

async function remove(projectId: string, ids: string[]) {
  const result = await db
    .delete(inboundLeads)
    .where(
      and(eq(inboundLeads.projectId, projectId), inArray(inboundLeads.id, ids)),
    )
    .returning({ id: inboundLeads.id });
  return result.length;
}

export const InboundLeadRepository = {
  findProjectsByDomain,
  insert,
  list,
  countByVerdict,
  countNew,
  update,
  remove,
};
