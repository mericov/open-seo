import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { AppError } from "@/server/lib/errors";
import {
  ShopifyConnectionRepository,
  type ShopifyConnection,
} from "@/server/features/shopify/repositories/ShopifyConnectionRepository";

const SHOPIFY_API_VERSION = "2026-04";

const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

export function shopifyError(message: string) {
  return new AppError("VALIDATION_ERROR", message);
}

async function secretKey() {
  const ctx = await getAuth().$context;
  return ctx.secretConfig;
}

export async function sealSecret(value: string) {
  return symmetricEncrypt({ key: await secretKey(), data: value });
}

export async function openSecret(value: string) {
  return symmetricDecrypt({ key: await secretKey(), data: value });
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  scope: z.string().optional(),
  expires_in: z.number().optional(),
});

export async function exchangeClientCredentials(
  shopDomain: string,
  clientId: string,
  clientSecret: string,
) {
  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  const body: unknown = await response.json().catch(() => null);
  const parsed = tokenResponseSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    throw shopifyError(
      `Shopify rejected the client credentials (${response.status}). Check the Client ID and secret, and that the app is installed on this store.`,
    );
  }
  return {
    accessToken: parsed.data.access_token,
    scopes: parsed.data.scope ?? null,
    expiresAt: parsed.data.expires_in
      ? new Date(Date.now() + parsed.data.expires_in * 1000).toISOString()
      : null,
  };
}

const graphqlResponseSchema = z.object({
  data: z.unknown().optional(),
  errors: z
    .union([
      z.array(z.object({ message: z.string() }).passthrough()),
      z.string(),
    ])
    .optional(),
  extensions: z.unknown().optional(),
});

export async function rawShopifyGraphql(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  const body: unknown = await response.json().catch(() => null);
  const parsed = graphqlResponseSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    const detail =
      parsed.success && typeof parsed.data.errors === "string"
        ? parsed.data.errors
        : `HTTP ${response.status}`;
    throw shopifyError(`Shopify API error: ${detail}`);
  }
  return parsed.data;
}

async function accessTokenFor(connection: ShopifyConnection) {
  if (!connection.accessToken) throw new AppError("NOT_FOUND");
  const expiresAt = connection.accessTokenExpiresAt
    ? Date.parse(connection.accessTokenExpiresAt)
    : null;
  const fresh =
    expiresAt === null || expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now();
  if (
    fresh ||
    connection.authMode !== "client_credentials" ||
    !connection.clientId ||
    !connection.clientSecret
  ) {
    return openSecret(connection.accessToken);
  }
  const token = await exchangeClientCredentials(
    connection.shopDomain,
    connection.clientId,
    await openSecret(connection.clientSecret),
  );
  await ShopifyConnectionRepository.updateToken(
    connection.projectId,
    await sealSecret(token.accessToken),
    token.expiresAt,
  );
  return token.accessToken;
}

export async function requireShopifyConnection(projectId: string) {
  const connection =
    await ShopifyConnectionRepository.getByProjectId(projectId);
  if (!connection) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Shopify is not connected for this project. Connect it in Settings → Integrations.",
    );
  }
  return connection;
}

export async function shopifyGraphql<T = unknown>(
  projectId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const connection = await requireShopifyConnection(projectId);
  const result = await rawShopifyGraphql(
    connection.shopDomain,
    await accessTokenFor(connection),
    query,
    variables,
  );
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    throw shopifyError(
      `Shopify API error: ${result.errors.map((error) => error.message).join("; ")}`,
    );
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callers describe the shape of their own query
  return result.data as T;
}

export async function shopifyGraphqlRaw(
  projectId: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  const connection = await requireShopifyConnection(projectId);
  return rawShopifyGraphql(
    connection.shopDomain,
    await accessTokenFor(connection),
    query,
    variables,
  );
}

type UserError = { field?: string[] | null; message: string };

export function throwOnUserErrors(
  userErrors: UserError[] | null | undefined,
  action: string,
) {
  if (userErrors && userErrors.length > 0) {
    throw shopifyError(
      `${action} failed: ${userErrors
        .map((error) =>
          error.field?.length
            ? `${error.field.join(".")}: ${error.message}`
            : error.message,
        )
        .join("; ")}`,
    );
  }
}
