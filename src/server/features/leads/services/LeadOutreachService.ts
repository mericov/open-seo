import { sortBy } from "remeda";
import {
  LeadListRepository,
  type LeadListFilters,
} from "@/server/features/leads/repositories/LeadListRepository";
import { ContactRegistryService } from "@/server/features/leads/services/ContactRegistryService";
import { leadEmailLanguage } from "@/shared/leadEmail";
import { followUpDueOn, type LeadMailStep } from "@/shared/leadFollowUp";
import {
  LEAD_OUTREACH_STATUSES,
  findingsForLead,
  type LeadNoteColor,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";

type ListedRow = Awaited<
  ReturnType<typeof LeadListRepository.listLeads>
>["rows"][number];

async function decorate(
  rows: ListedRow[],
  organizationId: string,
  projectId: string,
) {
  const [findings, prior] = await Promise.all([
    LeadListRepository.listFindings(rows.map((row) => row.id)),
    ContactRegistryService.priorContacts(organizationId, projectId, rows),
  ]);
  return rows.map(({ locationLabel, ...row }) => ({
    ...row,
    language: leadEmailLanguage({ ...row, locationLabel }),
    ...findingsForLead(findings, row.id),
    priorContact: prior.get(row.id) ?? null,
  }));
}

async function listLeads(
  projectId: string,
  organizationId: string,
  filters: LeadListFilters & { today?: string },
  page: { page: number; pageSize: number },
) {
  const { status: _status, today: _today, ...countFilters } = filters;
  const today = filters.today ?? new Date().toISOString().slice(0, 10);
  const [{ rows, total }, statusRows, due] = await Promise.all([
    LeadListRepository.listLeads(projectId, filters, {
      limit: page.pageSize,
      offset: (page.page - 1) * page.pageSize,
    }),
    LeadListRepository.statusCounts(projectId, countFilters),
    LeadListRepository.countDue(projectId, today),
  ]);

  const counts = Object.fromEntries(
    LEAD_OUTREACH_STATUSES.map((key) => [
      key,
      statusRows.find((row) => row.status === key)?.total ?? 0,
    ]),
  ) as Record<LeadOutreachStatus, number>;

  return {
    leads: await decorate(rows, organizationId, projectId),
    total,
    page: page.page,
    pageSize: page.pageSize,
    counts: {
      ...counts,
      all: statusRows.reduce((sum, row) => sum + row.total, 0),
      due,
    },
  };
}

const FOLLOW_UP_LIMIT = 500;

async function listFollowUps(
  projectId: string,
  organizationId: string,
  today: string,
) {
  // The shortest gap is three business days, so nothing sent in the last
  // three calendar days can be due yet.
  const cutoff = new Date(`${today}T23:59:59.999Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 3);
  const { rows } = await LeadListRepository.listLeads(
    projectId,
    { followUpBefore: cutoff.toISOString() },
    { limit: FOLLOW_UP_LIMIT, offset: 0 },
  );
  const due = sortBy(
    rows.flatMap((row) => {
      const sent = row.followUpStep;
      if ((sent !== 1 && sent !== 2) || !row.followUpSentAt) return [];
      const dueOn = followUpDueOn(sent, row.followUpSentAt);
      const step = sent === 1 ? (2 as const) : (3 as const);
      return dueOn <= today ? [{ row, dueOn, step }] : [];
    }),
    (item) => item.dueOn,
  );
  const decorated = await decorate(
    due.map((item) => item.row),
    organizationId,
    projectId,
  );
  return decorated.map((lead, index) => ({
    lead,
    step: due[index].step,
    dueOn: due[index].dueOn,
  }));
}

async function recordMail(
  projectId: string,
  organizationId: string,
  leadId: string,
  step: LeadMailStep,
) {
  await LeadListRepository.recordMail(projectId, leadId, step);
  if (
    step === 1 &&
    (await LeadListRepository.getOutreachStatus(projectId, leadId)) === "new"
  ) {
    await setStatus(projectId, organizationId, [leadId], "contacted");
  }
}

async function stopFollowUp(projectId: string, leadId: string) {
  await LeadListRepository.stopFollowUp(projectId, leadId);
}

async function setStatus(
  projectId: string,
  organizationId: string,
  leadIds: string[],
  status: LeadOutreachStatus,
) {
  await LeadListRepository.setOutreachStatus(projectId, leadIds, status);
  await ContactRegistryService.recordStatus(
    organizationId,
    projectId,
    leadIds,
    status,
  );
  return { updated: leadIds.length };
}

async function suppress(
  projectId: string,
  organizationId: string,
  leadIds: string[],
) {
  await ContactRegistryService.suppressLeads(
    organizationId,
    projectId,
    leadIds,
  );
  return { updated: leadIds.length };
}

async function setHidden(
  projectId: string,
  leadIds: string[],
  hidden: boolean,
) {
  await LeadListRepository.setHidden(projectId, leadIds, hidden);
  return { updated: leadIds.length };
}

async function setNote(
  projectId: string,
  leadId: string,
  note: { color: LeadNoteColor | null; text: string; remindAt: string | null },
) {
  const text = note.text.trim();
  await LeadListRepository.setNote(projectId, leadId, {
    color: note.color,
    text: text || null,
    remindAt: note.remindAt,
  });
}

export const LeadOutreachService = {
  listLeads,
  listFollowUps,
  recordMail,
  stopFollowUp,
  setStatus,
  suppress,
  setHidden,
  setNote,
};
