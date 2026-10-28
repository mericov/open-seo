import { z } from "zod";
import {
  InboundLeadRepository,
  type InboundLeadInsert,
} from "@/server/features/inbound-leads/repositories/InboundLeadRepository";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  INBOUND_LEAD_VERDICTS,
  type InboundLeadStatus,
  type InboundLeadVerdict,
} from "@/shared/inboundLeads";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const ingestSchema = z.object({
  domain: z.string().trim().toLowerCase().min(3).max(255),
  locale: text(10),
  source: text(80),
  page: text(500),
  name: text(200),
  email: text(320),
  phone: text(40),
  website: text(500),
  message: text(4000),
  secondsOnPage: z.number().int().min(0).max(10_000_000).nullish(),
  verdict: z.enum(INBOUND_LEAD_VERDICTS),
  reason: text(500),
});

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function handleIngest(request: Request): Promise<Response> {
  const secret = (await getOptionalEnvValue("INBOUND_LEADS_SECRET"))?.trim();
  if (!secret) return new Response("Not found", { status: 404 });
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !timingSafeEqual(token, secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const parsed = ingestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const { domain, ...lead } = parsed.data;

  const candidates = await InboundLeadRepository.findProjectsByDomain(domain);
  const project =
    candidates.find((row) => row.languageCode === lead.locale) ?? candidates[0];
  if (!project) return Response.json({ ok: false }, { status: 404 });

  const values: InboundLeadInsert = {
    ...lead,
    secondsOnPage: lead.secondsOnPage ?? null,
  };
  const id = await InboundLeadRepository.insert(project.id, values);
  return Response.json({ ok: true, id, projectId: project.id });
}

async function list(
  projectId: string,
  filters: { verdict?: InboundLeadVerdict; status?: InboundLeadStatus },
  paging: { page: number; pageSize: number },
) {
  const [{ rows, total }, verdictRows, newCount] = await Promise.all([
    InboundLeadRepository.list(projectId, filters, {
      limit: paging.pageSize,
      offset: (paging.page - 1) * paging.pageSize,
    }),
    InboundLeadRepository.countByVerdict(projectId),
    InboundLeadRepository.countNew(projectId),
  ]);
  const countOf = (verdict: InboundLeadVerdict) =>
    verdictRows.find((row) => row.verdict === verdict)?.total ?? 0;
  const counts = {
    ok: countOf("ok"),
    suspicious: countOf("suspicious"),
    spam: countOf("spam"),
  };
  return { leads: rows, total, page: paging.page, counts, newCount };
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
  const updated = await InboundLeadRepository.update(projectId, ids, values);
  return { updated };
}

async function remove(projectId: string, ids: string[]) {
  return { removed: await InboundLeadRepository.remove(projectId, ids) };
}

export const InboundLeadService = {
  handleIngest,
  list,
  update,
  remove,
};
