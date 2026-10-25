import {
  LeadListRepository,
  type LeadListFilters,
} from "@/server/features/leads/repositories/LeadListRepository";
import { ContactRegistryService } from "@/server/features/leads/services/ContactRegistryService";
import { leadEmailLanguage } from "@/shared/leadEmail";
import {
  LEAD_OUTREACH_STATUSES,
  findingsForLead,
  type LeadNoteColor,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";

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
  const [findings, prior] = await Promise.all([
    LeadListRepository.listFindings(rows.map((row) => row.id)),
    ContactRegistryService.priorContacts(organizationId, projectId, rows),
  ]);

  const counts = Object.fromEntries(
    LEAD_OUTREACH_STATUSES.map((key) => [
      key,
      statusRows.find((row) => row.status === key)?.total ?? 0,
    ]),
  ) as Record<LeadOutreachStatus, number>;

  return {
    leads: rows.map(({ locationLabel, ...row }) => ({
      ...row,
      language: leadEmailLanguage({ ...row, locationLabel }),
      ...findingsForLead(findings, row.id),
      priorContact: prior.get(row.id) ?? null,
    })),
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
  setStatus,
  suppress,
  setHidden,
  setNote,
};
