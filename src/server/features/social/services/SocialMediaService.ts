import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import {
  SocialMediaRepository,
  type SocialMediaAsset,
} from "@/server/features/social/repositories/SocialMediaRepository";
import { normalizeMedia } from "@/server/features/social/services/imageFormat";
import {
  SOCIAL_MEDIA_PATH_PREFIX,
  type SocialMediaSource,
} from "@/shared/social";

const MAX_BYTES = 95 * 1024 * 1024;
const REDIRECT_HOPS = 4;
const FETCH_TIMEOUT_MS = 60_000;
const R2_PREFIX = "social/";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export async function fetchUntrusted(rawUrl: string, method = "GET") {
  let url = await normalizeAndValidateStartUrl(rawUrl);
  for (let hop = 0; hop <= REDIRECT_HOPS; hop += 1) {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      headers: { "User-Agent": "MericSEO/1.0 (+social studio)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = await normalizeAndValidateStartUrl(new URL(location, url).href);
      continue;
    }
    return { response, finalUrl: url };
  }
  throw new AppError("VALIDATION_ERROR", "Too many redirects");
}

function preferJpeg(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "cdn.shopify.com")
      url.searchParams.set("format", "jpg");
    return url.href;
  } catch {
    return rawUrl;
  }
}

function toAsset(row: SocialMediaAsset) {
  return {
    id: row.id,
    url: row.url,
    contentType: row.contentType,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    source: row.source,
    sourceUrl: row.sourceUrl,
    label: row.label,
    createdAt: row.createdAt,
  };
}

async function store(input: {
  projectId: string;
  origin: string;
  bytes: Uint8Array;
  source: SocialMediaSource;
  sourceUrl: string | null;
  label: string | null;
}) {
  if (input.bytes.byteLength > MAX_BYTES)
    throw new AppError("VALIDATION_ERROR", "File is larger than 95 MB.");
  const media = await normalizeMedia(input.bytes);
  const id = crypto.randomUUID();
  const path = `${input.projectId}/${id}.${EXTENSIONS[media.contentType] ?? "bin"}`;
  const r2Key = `${R2_PREFIX}${path}`;
  await env.R2.put(r2Key, media.bytes, {
    httpMetadata: {
      contentType: media.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  const row = {
    id,
    projectId: input.projectId,
    r2Key,
    url: `${input.origin}${SOCIAL_MEDIA_PATH_PREFIX}${path}`,
    contentType: media.contentType,
    sizeBytes: media.bytes.byteLength,
    width: media.width,
    height: media.height,
    source: input.source,
    sourceUrl: input.sourceUrl,
    label: input.label,
  };
  await SocialMediaRepository.insert(row);
  return toAsset({ ...row, createdAt: new Date().toISOString() });
}

async function importFromUrl(input: {
  projectId: string;
  origin: string;
  url: string;
  source: SocialMediaSource;
  label: string | null;
}) {
  const { response } = await fetchUntrusted(preferJpeg(input.url));
  if (!response.ok)
    throw new AppError(
      "VALIDATION_ERROR",
      `Could not download ${input.url} (HTTP ${response.status}).`,
    );
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES)
    throw new AppError("VALIDATION_ERROR", "File is larger than 95 MB.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  return store({ ...input, bytes, sourceUrl: input.url });
}

async function list(projectId: string, limit = 120) {
  const rows = await SocialMediaRepository.list(projectId, limit);
  return rows.map(toAsset);
}

async function remove(projectId: string, id: string) {
  const removed = await SocialMediaRepository.remove(projectId, id);
  if (removed) await env.R2.delete(removed.r2Key);
  return { ok: true as const };
}

async function serve(path: string) {
  if (!/^[\w-]+\/[\w-]+\.(jpg|mp4|mov)$/.test(path))
    return new Response("Not found", { status: 404 });
  const object = await env.R2.get(`${R2_PREFIX}${path}`);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(object.body, { headers });
}

export const SocialMediaService = {
  store,
  importFromUrl,
  list,
  remove,
  serve,
  toAsset,
};
