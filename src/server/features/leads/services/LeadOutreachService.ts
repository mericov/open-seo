import {
  LeadListRepository,
  type LeadListFilters,
} from "@/server/features/leads/repositories/LeadListRepository";
import { leadEmailLanguage } from "@/shared/leadEmail";
import {
  LEAD_OUTREACH_STATUSES,
  sortFindingsByWeight,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";

async function listLeads(
  projectId: string,
  filters: LeadListFilters,
  page: { page: number; pageSize: number },
) {
  const { status: _status, ...countFilters } = filters;
  const [{ rows, total }, statusRows] = await Promise.all([
    LeadListRepository.listLeads(projectId, filters, {
      limit: page.pageSize,
      offset: (page.page - 1) * page.pageSize,
    }),
    LeadListRepository.statusCounts(projectId, countFilters),
  ]);
  const findings = await LeadListRepository.listFindings(
    rows.map((row) => row.id),
  );

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
      findings: sortFindingsByWeight(
        findings
          .filter((finding) => finding.leadId === row.id)
          .map((finding) => finding.code),
      ),
    })),
    total,
    page: page.page,
    pageSize: page.pageSize,
    counts: {
      ...counts,
      all: statusRows.reduce((sum, row) => sum + row.total, 0),
    },
  };
}

async function setStatus(
  projectId: string,
  leadIds: string[],
  status: LeadOutreachStatus,
) {
  await LeadListRepository.setOutreachStatus(projectId, leadIds, status);
  return { updated: leadIds.length };
}

export const LeadOutreachService = { listLeads, setStatus };
