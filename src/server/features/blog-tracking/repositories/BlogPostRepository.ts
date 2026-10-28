import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { projectBlogPosts } from "@/db/schema";
import type { TrackedPageKind } from "@/shared/pageTracking";

const ROWS_PER_INSERT = 10;
const IDS_PER_STATEMENT = 90;

type BlogPostInput = {
  url: string;
  title: string | null;
  targetKeyword: string | null;
  publishedAt: string | null;
  kind: TrackedPageKind;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function list(projectId: string) {
  return db
    .select()
    .from(projectBlogPosts)
    .where(
      and(
        eq(projectBlogPosts.projectId, projectId),
        isNull(projectBlogPosts.archivedAt),
      ),
    )
    .orderBy(asc(projectBlogPosts.createdAt), asc(projectBlogPosts.url));
}

async function get(projectId: string, id: string) {
  const [row] = await db
    .select()
    .from(projectBlogPosts)
    .where(
      and(
        eq(projectBlogPosts.projectId, projectId),
        eq(projectBlogPosts.id, id),
        isNull(projectBlogPosts.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function listAllUrls(projectId: string) {
  const rows = await db
    .select({ url: projectBlogPosts.url })
    .from(projectBlogPosts)
    .where(eq(projectBlogPosts.projectId, projectId));
  return rows.map((row) => row.url);
}

async function addDiscovered(
  projectId: string,
  pages: { url: string; kind: TrackedPageKind }[],
) {
  if (pages.length === 0) return;
  const now = new Date().toISOString();
  await runBatch((tx) =>
    chunk(pages, ROWS_PER_INSERT).map((pageChunk) =>
      tx
        .insert(projectBlogPosts)
        .values(
          pageChunk.map((page) => ({
            id: crypto.randomUUID(),
            projectId,
            url: page.url,
            kind: page.kind,
            source: "auto" as const,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing(),
    ),
  );
}

async function upsert(projectId: string, posts: BlogPostInput[]) {
  if (posts.length === 0) return;
  const updatedAt = new Date().toISOString();
  await runBatch((tx) =>
    chunk(posts, ROWS_PER_INSERT).map((postChunk) =>
      tx
        .insert(projectBlogPosts)
        .values(
          postChunk.map((post) => ({
            id: crypto.randomUUID(),
            projectId,
            ...post,
            createdAt: updatedAt,
            updatedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [projectBlogPosts.projectId, projectBlogPosts.url],
          set: {
            title: sql`coalesce(excluded.title, ${projectBlogPosts.title})`,
            targetKeyword: sql`coalesce(excluded.target_keyword, ${projectBlogPosts.targetKeyword})`,
            publishedAt: sql`coalesce(excluded.published_at, ${projectBlogPosts.publishedAt})`,
            kind: sql`excluded.kind`,
            archivedAt: null,
            updatedAt,
          },
        }),
    ),
  );
}

async function update(
  projectId: string,
  id: string,
  fields: Omit<BlogPostInput, "url" | "kind">,
) {
  await db
    .update(projectBlogPosts)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(projectBlogPosts.projectId, projectId),
        eq(projectBlogPosts.id, id),
      ),
    );
}

async function archive(projectId: string, ids: string[]) {
  if (ids.length === 0) return;
  const archivedAt = new Date().toISOString();
  await runBatch((tx) =>
    chunk(ids, IDS_PER_STATEMENT).map((idChunk) =>
      tx
        .update(projectBlogPosts)
        .set({ archivedAt, updatedAt: archivedAt })
        .where(
          and(
            eq(projectBlogPosts.projectId, projectId),
            inArray(projectBlogPosts.id, idChunk),
          ),
        ),
    ),
  );
}

export const BlogPostRepository = {
  list,
  get,
  listAllUrls,
  addDiscovered,
  upsert,
  update,
  archive,
};
