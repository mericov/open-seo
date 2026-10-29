import { AppError } from "@/server/lib/errors";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import {
  openSecret,
  sealSecret,
} from "@/server/features/shopify/services/shopifyClient";
import {
  MetaConnectionRepository,
  type MetaConnection,
} from "@/server/features/social/repositories/MetaConnectionRepository";
import {
  adAccountPath,
  graphGet,
} from "@/server/features/social/services/metaGraph";
import { defaultTimezone, META_REQUIRED_PERMISSIONS } from "@/shared/social";

type CheckResult = { label: string; ok: boolean; detail: string };

async function runCheck(
  label: string,
  run: () => Promise<string>,
): Promise<CheckResult> {
  try {
    return { label, ok: true, detail: await run() };
  } catch (error) {
    return {
      label,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function inspect(input: {
  token: string;
  pageId: string | null;
  instagramAccountId: string | null;
  adAccountId: string | null;
}) {
  let pageName: string | null = null;
  let instagramUsername: string | null = null;
  let adAccountName: string | null = null;
  let permissions: string[] = [];

  const checks: CheckResult[] = [];
  checks.push(
    await runCheck("token", async () => {
      const me = await graphGet<{ id: string; name?: string }>(
        "me",
        input.token,
        { fields: "id,name" },
      );
      return me.name ?? me.id;
    }),
  );
  checks.push(
    await runCheck("permissions", async () => {
      const result = await graphGet<{
        data: { permission: string; status: string }[];
      }>("me/permissions", input.token);
      permissions = result.data
        .filter((row) => row.status === "granted")
        .map((row) => row.permission);
      const missing = META_REQUIRED_PERMISSIONS.filter(
        (permission) => !permissions.includes(permission),
      );
      if (missing.length > 0) throw new Error(`Missing: ${missing.join(", ")}`);
      return permissions.join(", ");
    }),
  );
  if (input.pageId) {
    const pageId = input.pageId;
    checks.push(
      await runCheck("page", async () => {
        const page = await graphGet<{
          name: string;
          access_token?: string;
        }>(pageId, input.token, { fields: "name,access_token" });
        if (!page.access_token)
          throw new Error(
            "No page access token. Assign the Page to the system user with full control.",
          );
        pageName = page.name;
        return page.name;
      }),
    );
  }
  if (input.instagramAccountId) {
    const igId = input.instagramAccountId;
    checks.push(
      await runCheck("instagram", async () => {
        const account = await graphGet<{ username: string }>(
          igId,
          input.token,
          { fields: "username" },
        );
        instagramUsername = account.username;
        return `@${account.username}`;
      }),
    );
  }
  if (input.adAccountId) {
    const path = adAccountPath(input.adAccountId);
    checks.push(
      await runCheck("adAccount", async () => {
        const account = await graphGet<{
          name: string;
          account_status: number;
          currency: string;
        }>(path, input.token, { fields: "name,account_status,currency" });
        adAccountName = account.name;
        return `${account.name} (${account.currency}, status ${account.account_status})`;
      }),
    );
  }
  return { checks, pageName, instagramUsername, adAccountName, permissions };
}

function summarize(checks: CheckResult[]) {
  return checks
    .map(
      (check) => `${check.ok ? "OK" : "FAIL"} ${check.label}: ${check.detail}`,
    )
    .join("\n");
}

function cleanId(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function connect(input: {
  projectId: string;
  userId: string;
  pageId?: string;
  instagramAccountId?: string;
  adAccountId?: string;
  accessToken?: string;
  timezone?: string;
}) {
  const existing = await MetaConnectionRepository.getByProjectId(
    input.projectId,
  );
  const token =
    input.accessToken?.trim() ||
    (existing ? await openSecret(existing.accessToken) : "");
  if (!token)
    throw new AppError("VALIDATION_ERROR", "System User token is required.");
  const project = await ProjectRepository.getProjectById(input.projectId);
  if (!project) throw new AppError("NOT_FOUND");

  const ids = {
    pageId: cleanId(input.pageId),
    instagramAccountId: cleanId(input.instagramAccountId),
    adAccountId: cleanId(input.adAccountId)?.replace(/^act_/, "") ?? null,
  };
  const result = await inspect({ token, ...ids });
  const tokenCheck = result.checks.find((check) => check.label === "token");
  if (!tokenCheck?.ok)
    throw new AppError(
      "VALIDATION_ERROR",
      tokenCheck?.detail ?? "Token check failed",
    );

  await MetaConnectionRepository.upsert({
    projectId: input.projectId,
    ...ids,
    pageName: result.pageName,
    instagramUsername: result.instagramUsername,
    adAccountName: result.adAccountName,
    accessToken: await sealSecret(token),
    timezone:
      input.timezone ??
      existing?.timezone ??
      defaultTimezone(project.locationCode),
    permissions: result.permissions.join(",") || null,
    lastTestedAt: new Date().toISOString(),
    lastTestOk: result.checks.every((check) => check.ok),
    lastTestMessage: summarize(result.checks),
    connectedByUserId: input.userId,
  });
  return getConnection(input.projectId);
}

async function test(projectId: string) {
  const connection = await requireConnection(projectId);
  const result = await inspect({
    token: await openSecret(connection.accessToken),
    pageId: connection.pageId,
    instagramAccountId: connection.instagramAccountId,
    adAccountId: connection.adAccountId,
  });
  await MetaConnectionRepository.update(projectId, {
    pageName: result.pageName ?? connection.pageName,
    instagramUsername: result.instagramUsername ?? connection.instagramUsername,
    adAccountName: result.adAccountName ?? connection.adAccountName,
    permissions: result.permissions.join(",") || connection.permissions,
    lastTestedAt: new Date().toISOString(),
    lastTestOk: result.checks.every((check) => check.ok),
    lastTestMessage: summarize(result.checks),
  });
  return { checks: result.checks };
}

async function getConnection(projectId: string) {
  const row = await MetaConnectionRepository.getByProjectId(projectId);
  if (!row) {
    const project = await ProjectRepository.getProjectById(projectId);
    return {
      connected: false as const,
      timezone: defaultTimezone(project?.locationCode ?? 2840),
    };
  }
  return {
    connected: true as const,
    pageId: row.pageId,
    pageName: row.pageName,
    instagramAccountId: row.instagramAccountId,
    instagramUsername: row.instagramUsername,
    adAccountId: row.adAccountId,
    adAccountName: row.adAccountName,
    timezone: row.timezone,
    permissions: row.permissions ? row.permissions.split(",") : [],
    lastTestedAt: row.lastTestedAt,
    lastTestOk: row.lastTestOk,
    lastTestMessage: row.lastTestMessage,
    connectedAt: row.createdAt,
  };
}

async function disconnect(projectId: string) {
  await MetaConnectionRepository.deleteByProjectId(projectId);
  return { ok: true as const };
}

async function requireConnection(projectId: string): Promise<MetaConnection> {
  const connection = await MetaConnectionRepository.getByProjectId(projectId);
  if (!connection)
    throw new AppError(
      "VALIDATION_ERROR",
      "Meta is not connected for this project. Connect it in Settings → Integrations.",
    );
  return connection;
}

async function tokenFor(connection: MetaConnection) {
  return openSecret(connection.accessToken);
}

async function pageTokenFor(connection: MetaConnection) {
  if (!connection.pageId)
    throw new AppError("VALIDATION_ERROR", "No Facebook Page ID saved.");
  const page = await graphGet<{ access_token?: string }>(
    connection.pageId,
    await tokenFor(connection),
    { fields: "access_token" },
  );
  if (!page.access_token)
    throw new AppError(
      "VALIDATION_ERROR",
      "Meta returned no Page access token. Assign the Page to the system user.",
    );
  return page.access_token;
}

export const MetaConnectionService = {
  connect,
  test,
  getConnection,
  disconnect,
  requireConnection,
  tokenFor,
  pageTokenFor,
};
