import { sortBy } from "remeda";
import { MediaLibraryRepository } from "@/server/features/digital-pr/repositories/MediaLibraryRepository";
import { AppError } from "@/server/lib/errors";
import {
  PrTargetRepository,
  type TargetListFilters,
} from "@/server/features/digital-pr/repositories/PrTargetRepository";
import {
  addDays,
  PR_CONTACT_COOLDOWN_DAYS,
  PR_FOLLOW_UP_DAYS,
  prLanguageForMarket,
  type PrLanguage,
  type PrTargetStatus,
} from "@/shared/digitalPr";

const EMAIL_ROLE_ORDER = { editor: 0, author: 1, general: 2 } as const;

async function listTargets(
  project: { id: string; name: string; domain: string | null },
  organizationId: string,
  filters: TargetListFilters & { today?: string },
  page: { page: number; pageSize: number },
) {
  const projectId = project.id;
  const today = filters.today ?? new Date().toISOString().slice(0, 10);
  const [{ rows, total }, statusRows, due] = await Promise.all([
    PrTargetRepository.listTargets(projectId, filters, {
      limit: page.pageSize,
      offset: (page.page - 1) * page.pageSize,
    }),
    PrTargetRepository.statusCounts(projectId),
    PrTargetRepository.countDue(projectId, today),
  ]);
  const outletOnly = rows.filter((row) => !row.contactId);
  const contactIds = rows.flatMap((row) =>
    row.contactId ? [row.contactId] : [],
  );
  const [outletEmails, articles, elsewhere] = await Promise.all([
    PrTargetRepository.emailsForOutlets(outletOnly.map((row) => row.outletId)),
    MediaLibraryRepository.listRecentArticles(contactIds, 1),
    PrTargetRepository.recentContactsElsewhere(
      projectId,
      organizationId,
      {
        contactIds,
        outletIds: rows.map((row) => row.outletId),
      },
      addDays(new Date().toISOString(), -PR_CONTACT_COOLDOWN_DAYS),
    ),
  ]);

  const countFor = (status: PrTargetStatus) =>
    statusRows.find((row) => row.status === status)?.total ?? 0;
  const counts: Record<PrTargetStatus, number> = {
    new: countFor("new"),
    drafted: countFor("drafted"),
    pitched: countFor("pitched"),
    followup: countFor("followup"),
    replied: countFor("replied"),
    won: countFor("won"),
    declined: countFor("declined"),
  };

  return {
    project: { name: project.name, domain: project.domain },
    total,
    page: page.page,
    pageSize: page.pageSize,
    counts: {
      ...counts,
      all: statusRows.reduce((sum, row) => sum + row.total, 0),
      due,
    },
    targets: rows.map((row) => {
      const fallback = sortBy(
        outletEmails.filter((entry) => entry.outletId === row.outletId),
        (entry) => EMAIL_ROLE_ORDER[entry.role],
      );
      const email = row.contactEmail ?? fallback[0]?.email ?? null;
      const article = row.contactId
        ? articles.find((entry) => entry.contactId === row.contactId)
        : undefined;
      const warning =
        elsewhere.find(
          (entry) =>
            (row.contactId && entry.contactId === row.contactId) ||
            entry.outletId === row.outletId,
        ) ?? null;
      return {
        ...row,
        email,
        otherEmails: fallback
          .slice(1)
          .flatMap((entry) => (entry.email ? [entry.email] : [])),
        language: prLanguageForMarket(row.market) satisfies PrLanguage,
        latestArticle: article
          ? {
              title: article.title,
              url: article.url,
              publishedAt: article.publishedAt,
            }
          : null,
        contactedElsewhere: warning
          ? {
              projectName: warning.projectName,
              contactedAt: warning.contactedAt,
              sameContact: Boolean(
                row.contactId && warning.contactId === row.contactId,
              ),
            }
          : null,
      };
    }),
  };
}

function followUpDate(now: string) {
  return addDays(now, PR_FOLLOW_UP_DAYS).slice(0, 10);
}

async function setStatus(
  projectId: string,
  ids: string[],
  status: PrTargetStatus,
) {
  const now = new Date().toISOString();
  if (status === "pitched" || status === "followup") {
    await PrTargetRepository.setStatus(projectId, ids, status, {
      contactedAt: now,
      remindAt: followUpDate(now),
    });
  } else if (
    status === "replied" ||
    status === "won" ||
    status === "declined"
  ) {
    await PrTargetRepository.setStatus(projectId, ids, status, {
      remindAt: null,
    });
  } else {
    await PrTargetRepository.setStatus(projectId, ids, status, {});
  }
  return { updated: ids.length };
}

async function markSent(projectId: string, id: string) {
  const [target] = await PrTargetRepository.getTargets(projectId, [id]);
  if (!target) throw new AppError("NOT_FOUND");
  const next: PrTargetStatus =
    target.status === "pitched" || target.status === "followup"
      ? "followup"
      : "pitched";
  return setStatus(projectId, [id], next);
}

async function setNote(
  projectId: string,
  id: string,
  values: { noteText: string; remindAt: string | null },
) {
  await PrTargetRepository.setNote(projectId, id, {
    noteText: values.noteText.trim() || null,
    remindAt: values.remindAt,
  });
}

async function setPitch(projectId: string, id: string, pitch: string) {
  const text = pitch.trim();
  await PrTargetRepository.setPitch(projectId, id, text || null);
  if (text) await PrTargetRepository.markDrafted(projectId, [id]);
}

async function removeTargets(projectId: string, ids: string[]) {
  await PrTargetRepository.removeTargets(projectId, ids);
  return { removed: ids.length };
}

export const PrOutreachService = {
  listTargets,
  setStatus,
  markSent,
  setNote,
  setPitch,
  removeTargets,
};
