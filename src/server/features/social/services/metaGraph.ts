import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { META_GRAPH_VERSION } from "@/shared/social";

const GRAPH_ORIGIN = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 30_000;

type GraphParams = Record<string, string | number | boolean | undefined>;

const graphErrorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      code: z.number().optional(),
      error_user_msg: z.string().optional(),
    })
    .optional(),
});

class MetaGraphError extends AppError {
  constructor(
    message: string,
    readonly graphCode: number | null,
  ) {
    super("VALIDATION_ERROR", message);
  }
}

function graphUrl(path: string, params: GraphParams) {
  const url = new URL(
    `${GRAPH_ORIGIN}/${META_GRAPH_VERSION}/${path.replace(/^\//, "")}`,
  );
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

async function parse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = graphErrorSchema.safeParse(body).data?.error;
    throw new MetaGraphError(
      `Meta API: ${error?.error_user_msg || error?.message || `HTTP ${response.status}`}`,
      error?.code ?? null,
    );
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callers describe the shape of their own Graph call
  return body as T;
}

export async function graphGet<T>(
  path: string,
  token: string,
  params: GraphParams = {},
) {
  const response = await fetch(graphUrl(path, params), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return parse<T>(response);
}

export async function graphPost<T>(
  path: string,
  token: string,
  params: GraphParams = {},
) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.set(key, String(value));
  }
  const response = await fetch(graphUrl(path, {}), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return parse<T>(response);
}

export function adAccountPath(adAccountId: string) {
  const id = adAccountId.trim().replace(/^act_/, "");
  return `act_${id}`;
}
