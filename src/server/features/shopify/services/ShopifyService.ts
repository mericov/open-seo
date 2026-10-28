import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { ShopifyConnectionRepository } from "@/server/features/shopify/repositories/ShopifyConnectionRepository";
import {
  exchangeClientCredentials,
  rawShopifyGraphql,
  sealSecret,
  shopifyError,
  shopifyGraphql,
  shopifyGraphqlRaw,
} from "@/server/features/shopify/services/shopifyClient";
import {
  normalizeShopDomain,
  SHOPIFY_RECOMMENDED_SCOPES,
  type ShopifyAuthMode,
} from "@/shared/shopify";

const SHOP_QUERY = `query MericSeoShop {
  shop { name currencyCode primaryDomain { host url } myshopifyDomain plan { displayName } }
  currentAppInstallation { accessScopes { handle } }
}`;

const shopSchema = z.object({
  shop: z.object({
    name: z.string(),
    currencyCode: z.string().nullish(),
    primaryDomain: z.object({ host: z.string(), url: z.string() }).nullish(),
    plan: z.object({ displayName: z.string().nullish() }).nullish(),
  }),
  currentAppInstallation: z
    .object({
      accessScopes: z.array(z.object({ handle: z.string() })),
    })
    .nullish(),
});

async function connect(input: {
  projectId: string;
  userId: string;
  shopDomain: string;
  authMode: ShopifyAuthMode;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}) {
  const shopDomain = normalizeShopDomain(input.shopDomain);
  if (!shopDomain) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Use the store's myshopify.com domain, for example my-store.myshopify.com.",
    );
  }

  let accessToken: string;
  let expiresAt: string | null = null;
  if (input.authMode === "client_credentials") {
    if (!input.clientId || !input.clientSecret) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Client ID and secret are required.",
      );
    }
    const token = await exchangeClientCredentials(
      shopDomain,
      input.clientId,
      input.clientSecret,
    );
    accessToken = token.accessToken;
    expiresAt = token.expiresAt;
  } else {
    if (!input.accessToken) {
      throw new AppError("VALIDATION_ERROR", "Access token is required.");
    }
    accessToken = input.accessToken;
  }

  const result = await rawShopifyGraphql(shopDomain, accessToken, SHOP_QUERY);
  const parsed = shopSchema.safeParse(result.data);
  if (!parsed.success) {
    throw shopifyError(
      "Shopify accepted the request but returned no store details. Check the token's access scopes.",
    );
  }
  const scopes =
    parsed.data.currentAppInstallation?.accessScopes
      .map((scope) => scope.handle)
      .join(",") ?? null;

  await ShopifyConnectionRepository.upsert({
    projectId: input.projectId,
    shopDomain,
    shopName: parsed.data.shop.name,
    primaryDomain: parsed.data.shop.primaryDomain?.host ?? null,
    currencyCode: parsed.data.shop.currencyCode ?? null,
    authMode: input.authMode,
    clientId: input.authMode === "client_credentials" ? input.clientId! : null,
    clientSecret:
      input.authMode === "client_credentials"
        ? await sealSecret(input.clientSecret!)
        : null,
    accessToken: await sealSecret(accessToken),
    accessTokenExpiresAt: expiresAt,
    scopes,
    connectedByUserId: input.userId,
  });
  return getConnection(input.projectId);
}

async function getConnection(projectId: string) {
  const row = await ShopifyConnectionRepository.getByProjectId(projectId);
  if (!row) return { connected: false as const };
  const scopes = row.scopes ? row.scopes.split(",").filter(Boolean) : [];
  return {
    connected: true as const,
    shopDomain: row.shopDomain,
    shopName: row.shopName,
    primaryDomain: row.primaryDomain,
    currencyCode: row.currencyCode,
    authMode: row.authMode,
    scopes,
    missingScopes: row.scopes
      ? SHOPIFY_RECOMMENDED_SCOPES.filter(
          (scope) =>
            !scopes.includes(scope) &&
            !(
              scope.startsWith("read_") &&
              scopes.includes(scope.replace("read_", "write_"))
            ),
        )
      : [],
    connectedAt: row.createdAt,
  };
}

async function disconnect(projectId: string) {
  await ShopifyConnectionRepository.deleteByProjectId(projectId);
  return { ok: true as const };
}

const shopifyqlSchema = z.object({
  shopifyqlQuery: z
    .object({
      parseErrors: z.unknown().optional(),
      tableData: z
        .object({
          columns: z.array(z.object({ name: z.string() })),
          rows: z.unknown(),
        })
        .nullish(),
    })
    .nullish(),
});

const SHOPIFYQL_QUERY = `query MericSeoShopifyql($query: String!) {
  shopifyqlQuery(query: $query) {
    parseErrors
    tableData { columns { name } rows }
  }
}`;

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function hasParseErrors(value: unknown) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

async function runShopifyql(projectId: string, query: string) {
  const result = await shopifyGraphqlRaw(projectId, SHOPIFYQL_QUERY, {
    query,
  });
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return {
      ok: false as const,
      error: result.errors.map((error) => error.message).join("; "),
    };
  }
  const parsed = shopifyqlSchema.safeParse(result.data);
  const data = parsed.success ? parsed.data.shopifyqlQuery : null;
  if (!data?.tableData || hasParseErrors(data.parseErrors)) {
    return {
      ok: false as const,
      error: data?.parseErrors
        ? JSON.stringify(data.parseErrors)
        : "No data returned",
    };
  }
  const columns = data.tableData.columns.map((column) => column.name);
  const rawRows = Array.isArray(data.tableData.rows) ? data.tableData.rows : [];
  const rows = rawRows.map((row: unknown): Record<string, unknown> => {
    if (Array.isArray(row)) {
      const cells: unknown[] = row;
      return Object.fromEntries(columns.map((name, i) => [name, cells[i]]));
    }
    return row && typeof row === "object" ? { ...row } : {};
  });
  return { ok: true as const, columns, rows };
}

async function runShopifyqlWithFallback(projectId: string, queries: string[]) {
  let last: Awaited<ReturnType<typeof runShopifyql>> = {
    ok: false,
    error: "No query",
  };
  for (const query of queries) {
    last = await runShopifyql(projectId, query);
    if (last.ok) return last;
  }
  return last;
}

function sumColumn(rows: Record<string, unknown>[], column: string) {
  let total = 0;
  let found = false;
  for (const row of rows) {
    const value = toNumber(row[column]);
    if (value !== null) {
      total += value;
      found = true;
    }
  }
  return found ? total : null;
}

function dayKey(row: Record<string, unknown>) {
  const value = row.day ?? row.date ?? row.Day;
  return typeof value === "string" ? value.slice(0, 10) : null;
}

const PERIOD_DAYS = 30;

async function getOverview(projectId: string) {
  const connection =
    await ShopifyConnectionRepository.getByProjectId(projectId);
  if (!connection) return { connected: false as const };

  const since = `-${PERIOD_DAYS}d`;
  const prevSince = `-${PERIOD_DAYS * 2}d`;
  const prevUntil = `-${PERIOD_DAYS + 1}d`;

  const [sessions, prevSessions, sales, prevSales, counts] = await Promise.all([
    runShopifyqlWithFallback(projectId, [
      `FROM sessions SHOW sessions TIMESERIES day SINCE ${since} UNTIL today`,
      `FROM sessions SHOW sessions GROUP BY day SINCE ${since} UNTIL today ORDER BY day`,
    ]),
    runShopifyqlWithFallback(projectId, [
      `FROM sessions SHOW sessions SINCE ${prevSince} UNTIL ${prevUntil}`,
    ]),
    runShopifyqlWithFallback(projectId, [
      `FROM sales SHOW orders, total_sales TIMESERIES day SINCE ${since} UNTIL today`,
      `FROM sales SHOW orders, total_sales GROUP BY day SINCE ${since} UNTIL today ORDER BY day`,
    ]),
    runShopifyqlWithFallback(projectId, [
      `FROM sales SHOW orders, total_sales SINCE ${prevSince} UNTIL ${prevUntil}`,
    ]),
    shopifyGraphql<{ productsCount?: { count: number } | null }>(
      projectId,
      `query MericSeoCounts { productsCount { count } }`,
    ).catch(() => null),
  ]);

  const sessionRows = sessions.ok ? sessions.rows : [];
  const salesRows = sales.ok ? sales.rows : [];
  const salesByDay = new Map(
    salesRows.map((row) => [dayKey(row), row] as const),
  );
  const daily = sessionRows
    .map((row) => {
      const day = dayKey(row);
      const saleRow = salesByDay.get(day);
      return {
        day,
        sessions: toNumber(row.sessions),
        orders: saleRow ? toNumber(saleRow.orders) : null,
      };
    })
    .filter(
      (
        row,
      ): row is {
        day: string;
        sessions: number | null;
        orders: number | null;
      } => Boolean(row.day),
    );

  return {
    connected: true as const,
    shopName: connection.shopName,
    shopDomain: connection.shopDomain,
    primaryDomain: connection.primaryDomain,
    currencyCode: connection.currencyCode,
    periodDays: PERIOD_DAYS,
    totals: {
      sessions: sessions.ok ? sumColumn(sessionRows, "sessions") : null,
      orders: sales.ok ? sumColumn(salesRows, "orders") : null,
      totalSales: sales.ok ? sumColumn(salesRows, "total_sales") : null,
    },
    prevTotals: {
      sessions: prevSessions.ok
        ? sumColumn(prevSessions.rows, "sessions")
        : null,
      orders: prevSales.ok ? sumColumn(prevSales.rows, "orders") : null,
      totalSales: prevSales.ok
        ? sumColumn(prevSales.rows, "total_sales")
        : null,
    },
    productCount: counts?.productsCount?.count ?? null,
    daily,
    analyticsError: sessions.ok ? null : sessions.error,
    salesError: sales.ok ? null : sales.error,
  };
}

const GUARDED_MUTATIONS =
  /\b(themeFilesUpsert|themeFilesDelete|themeFilesCopy|themePublish|themeDelete)\b/;

async function adminGraphql(
  projectId: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  if (GUARDED_MUTATIONS.test(query)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Theme writes go through the theme tools so the live theme stays untouched: create_shopify_theme_copy, write_shopify_theme_files, publish_shopify_theme.",
    );
  }
  return shopifyGraphqlRaw(projectId, query, variables);
}

export const ShopifyService = {
  connect,
  getConnection,
  disconnect,
  getOverview,
  runShopifyql,
  adminGraphql,
};
