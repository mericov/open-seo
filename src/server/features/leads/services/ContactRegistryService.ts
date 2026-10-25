import { ContactRegistryRepository } from "@/server/features/leads/repositories/ContactRegistryRepository";
import { LeadListRepository } from "@/server/features/leads/repositories/LeadListRepository";
import { contactKeyFor } from "@/shared/leads";
import type { LeadOutreachStatus } from "@/shared/leadFindings";

type PriorContact = {
  contactedAt: string | null;
  otherProject: boolean;
  suppressed: boolean;
};

const CONTACTED_STATUSES: LeadOutreachStatus[] = [
  "contacted",
  "replied",
  "client",
];

// Flags leads the organization already wrote to, from this project under
// another lead or from any other project, and leads it chose never to contact.
async function priorContacts(
  organizationId: string,
  projectId: string,
  leads: {
    id: string;
    domain: string | null;
    primaryEmail: string | null;
    outreachStatus: LeadOutreachStatus;
  }[],
) {
  const keyed = leads.flatMap((lead) => {
    const key = contactKeyFor(lead);
    return key ? [{ lead, key }] : [];
  });
  const rows = await ContactRegistryRepository.listByKeys(
    organizationId,
    keyed.map((row) => row.key),
  );
  const byKey = new Map(rows.map((row) => [row.contactKey, row]));
  const result = new Map<string, PriorContact>();
  for (const { lead, key } of keyed) {
    const row = byKey.get(key);
    if (!row) continue;
    const otherProject = row.lastProjectId !== projectId;
    const contactedElsewhere =
      row.lastContactedAt != null &&
      (otherProject || lead.outreachStatus === "new");
    if (!row.suppressedAt && !contactedElsewhere) continue;
    result.set(lead.id, {
      contactedAt: row.lastContactedAt,
      otherProject,
      suppressed: row.suppressedAt != null,
    });
  }
  return result;
}

async function keysForLeads(projectId: string, leadIds: string[]) {
  const rows = await LeadListRepository.listContactFields(projectId, leadIds);
  return rows.flatMap((row) => {
    const key = contactKeyFor(row);
    return key ? [key] : [];
  });
}

async function recordStatus(
  organizationId: string,
  projectId: string,
  leadIds: string[],
  status: LeadOutreachStatus,
) {
  if (!CONTACTED_STATUSES.includes(status)) return;
  await ContactRegistryRepository.recordContacts(
    organizationId,
    projectId,
    await keysForLeads(projectId, leadIds),
  );
}

async function suppressLeads(
  organizationId: string,
  projectId: string,
  leadIds: string[],
) {
  await ContactRegistryRepository.suppress(
    organizationId,
    projectId,
    await keysForLeads(projectId, leadIds),
  );
  await LeadListRepository.setHidden(projectId, leadIds, true);
}

export const ContactRegistryService = {
  priorContacts,
  recordStatus,
  suppressLeads,
};
