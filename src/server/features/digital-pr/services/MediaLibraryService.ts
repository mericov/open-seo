import { MediaLibraryRepository } from "@/server/features/digital-pr/repositories/MediaLibraryRepository";
import { AppError } from "@/server/lib/errors";
import { normalizeDomain } from "@/server/features/leads/services/leadSources";
import { MediaRepository } from "@/server/features/digital-pr/repositories/MediaRepository";
import type { OutletListFilters } from "@/server/features/digital-pr/repositories/MediaLibraryRepository";
import { PrTargetRepository } from "@/server/features/digital-pr/repositories/PrTargetRepository";
import type {
  MediaContactRole,
  MediaOutletType,
  PrMarket,
} from "@/shared/digitalPr";

async function listOutlets(
  organizationId: string,
  projectId: string,
  filters: OutletListFilters,
  page: { page: number; pageSize: number },
) {
  const { rows, total } = await MediaLibraryRepository.listOutlets(
    organizationId,
    filters,
    { limit: page.pageSize, offset: (page.page - 1) * page.pageSize },
  );
  const outletIds = rows.map((row) => row.id);
  const [contacts, topics, targetedOutlets] = await Promise.all([
    MediaLibraryRepository.listContactsForOutlets(outletIds),
    MediaLibraryRepository.listTopicsForOutlets(outletIds),
    PrTargetRepository.targetedOutletIds(projectId, outletIds),
  ]);
  const contactIds = contacts.map((contact) => contact.id);
  const [articles, targetedContacts] = await Promise.all([
    MediaLibraryRepository.listRecentArticles(contactIds, 3),
    PrTargetRepository.targetedContactIds(projectId, contactIds),
  ]);
  return {
    total,
    page: page.page,
    pageSize: page.pageSize,
    outlets: rows.map((row) => ({
      id: row.id,
      domain: row.domain,
      name: row.name,
      type: row.type,
      market: row.market,
      source: row.source,
      homepageUrl: row.homepageUrl,
      mastheadUrl: row.mastheadUrl,
      contactPageUrl: row.contactPageUrl,
      organicTraffic: row.organicTraffic,
      domainRank: row.domainRank,
      enrichStatus: row.enrichStatus,
      notes: row.notes,
      edited: row.editedAt !== null,
      hidden: row.hiddenAt !== null,
      lastSeenAt: row.lastSeenAt,
      inList: targetedOutlets.has(row.id),
      topics: topics
        .filter((topic) => topic.outletId === row.id)
        .map((topic) => ({ id: topic.topicId, keyword: topic.keyword })),
      contacts: contacts
        .filter((contact) => contact.outletId === row.id)
        .map((contact) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          jobTitle: contact.jobTitle,
          role: contact.role,
          source: contact.source,
          articleCount: contact.articleCount,
          lastArticleAt: contact.lastArticleAt,
          edited: contact.editedAt !== null,
          inList: targetedContacts.has(contact.id),
          recentArticles: articles
            .filter((article) => article.contactId === contact.id)
            .map((article) => ({
              title: article.title,
              url: article.url,
              publishedAt: article.publishedAt,
            })),
        })),
    })),
  };
}

async function addOutlet(
  organizationId: string,
  input: { domain: string; market: PrMarket; type: MediaOutletType },
) {
  const domain = normalizeDomain(input.domain);
  if (!domain) throw new AppError("VALIDATION_ERROR", "Enter a valid domain.");
  const now = new Date().toISOString();
  const { ids } = await MediaRepository.upsertOutlets(
    organizationId,
    [
      {
        domain,
        name: null,
        type: input.type,
        market: input.market,
        source: "manual",
        homepageUrl: `https://${domain}/`,
      },
    ],
    now,
  );
  return { outletId: ids.get(domain) ?? null };
}

async function updateOutlet(
  organizationId: string,
  outletId: string,
  values: {
    name: string | null;
    type: MediaOutletType;
    market: PrMarket;
    notes: string | null;
  },
) {
  const outlet = await MediaLibraryRepository.getOutlet(
    organizationId,
    outletId,
  );
  if (!outlet) throw new AppError("NOT_FOUND");
  await MediaLibraryRepository.updateOutlet(organizationId, outletId, {
    name: values.name?.trim() || null,
    type: values.type,
    market: values.market,
    notes: values.notes?.trim() || null,
  });
}

async function setOutletsHidden(
  organizationId: string,
  outletIds: string[],
  hidden: boolean,
) {
  await MediaLibraryRepository.setOutletsHidden(
    organizationId,
    outletIds,
    hidden,
  );
  return { updated: outletIds.length };
}

async function rescanOutlets(organizationId: string, outletIds: string[]) {
  await MediaLibraryRepository.resetOutletsForRescan(organizationId, outletIds);
  return { queued: outletIds.length };
}

async function saveContact(
  organizationId: string,
  input: {
    outletId: string;
    contactId?: string;
    name: string | null;
    email: string | null;
    jobTitle: string | null;
    role: MediaContactRole;
  },
) {
  const outlet = await MediaLibraryRepository.getOutlet(
    organizationId,
    input.outletId,
  );
  if (!outlet) throw new AppError("NOT_FOUND");
  if (input.contactId) {
    const contact = await MediaLibraryRepository.getContact(
      organizationId,
      input.contactId,
    );
    if (!contact || contact.outletId !== outlet.id) {
      throw new AppError("NOT_FOUND");
    }
  }
  const name = input.name?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  if (!name && !email) {
    throw new AppError("VALIDATION_ERROR", "Add a name or an email.");
  }
  const contactId = await MediaLibraryRepository.saveContact(
    outlet.id,
    input.contactId ?? null,
    {
      name,
      email,
      jobTitle: input.jobTitle?.trim() || null,
      role: input.role,
    },
  );
  return { contactId };
}

async function setContactHidden(
  organizationId: string,
  contactId: string,
  hidden: boolean,
) {
  const contact = await MediaLibraryRepository.getContact(
    organizationId,
    contactId,
  );
  if (!contact) throw new AppError("NOT_FOUND");
  await MediaLibraryRepository.setContactHidden(contactId, hidden);
}

async function addToList(
  organizationId: string,
  projectId: string,
  input: { outletIds: string[]; contactIds: string[] },
) {
  const [outlets, contacts] = await Promise.all([
    MediaLibraryRepository.outletsInOrg(organizationId, input.outletIds),
    MediaLibraryRepository.contactsInOrg(organizationId, input.contactIds),
  ]);
  return PrTargetRepository.addTargets(projectId, [
    ...outlets.map((outlet) => ({
      outletId: outlet.id,
      contactId: null,
      source: "media" as const,
    })),
    ...contacts.map((contact) => ({
      outletId: contact.outletId,
      contactId: contact.id,
      source: "media" as const,
    })),
  ]);
}

export const MediaLibraryService = {
  listOutlets,
  addOutlet,
  updateOutlet,
  setOutletsHidden,
  rescanOutlets,
  saveContact,
  setContactHidden,
  addToList,
};
