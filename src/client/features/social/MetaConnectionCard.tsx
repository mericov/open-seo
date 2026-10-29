import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Megaphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CardShell } from "@/client/components/CardShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  formatSocialDate,
  metaConnectionOptions,
  socialQueryKey,
} from "@/client/features/social/socialQueries";
import {
  connectMeta,
  disconnectMeta,
  testMetaConnection,
} from "@/serverFunctions/social";
import { SOCIAL_TIMEZONES } from "@/shared/social";

type Timezone = (typeof SOCIAL_TIMEZONES)[number];

const CHECK_LABELS = [
  "token",
  "permissions",
  "page",
  "instagram",
  "adAccount",
] as const;

function checkLabel(label: string) {
  return CHECK_LABELS.find((known) => known === label) ?? null;
}

function isTimezone(value: string): value is Timezone {
  return (SOCIAL_TIMEZONES as readonly string[]).includes(value);
}

export function MetaConnectionCard({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("social");
  const queryClient = useQueryClient();
  const connectionQuery = useQuery(metaConnectionOptions(projectId));
  const [editing, setEditing] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [checks, setChecks] = useState<
    { label: string; ok: boolean; detail: string }[] | null
  >(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: socialQueryKey(projectId) });

  const testMutation = useMutation({
    mutationFn: () => testMetaConnection({ data: { projectId } }),
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      setChecks(response.result.checks);
      await refresh();
      if (response.result.checks.every((check) => check.ok))
        toast.success(t("connection.testOk"));
      else toast.error(t("connection.testFailed"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectMeta({ data: { projectId } }),
    onSuccess: async () => {
      await refresh();
      setConfirmingDisconnect(false);
      toast.success(t("connection.disconnected"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const connection = connectionQuery.data;
  const parsedChecks =
    checks ??
    (connection?.connected && connection.lastTestMessage
      ? connection.lastTestMessage.split("\n").map((line) => {
          const [status, rest = ""] = line.split(/ (.*)/s);
          const [label = "", detail = ""] = rest.split(/: (.*)/s);
          return { label, ok: status === "OK", detail };
        })
      : null);

  return (
    <CardShell
      title={t("connection.title")}
      icon={<Megaphone className="size-4" />}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {t("connection.description")}
      </p>
      {!connection ? (
        <Skeleton className="h-24" />
      ) : connection.connected && !editing ? (
        <div className="space-y-3">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">{t("connection.page")}</dt>
            <dd>
              {connection.pageName ?? "—"}{" "}
              <span className="text-muted-foreground">
                {connection.pageId ?? ""}
              </span>
            </dd>
            <dt className="text-muted-foreground">
              {t("connection.instagram")}
            </dt>
            <dd>
              {connection.instagramUsername
                ? `@${connection.instagramUsername}`
                : "—"}{" "}
              <span className="text-muted-foreground">
                {connection.instagramAccountId ?? ""}
              </span>
            </dd>
            <dt className="text-muted-foreground">
              {t("connection.adAccount")}
            </dt>
            <dd>
              {connection.adAccountName ?? "—"}{" "}
              <span className="text-muted-foreground">
                {connection.adAccountId ? `act_${connection.adAccountId}` : ""}
              </span>
            </dd>
            <dt className="text-muted-foreground">
              {t("connection.timezone")}
            </dt>
            <dd>{connection.timezone}</dd>
          </dl>
          {parsedChecks ? (
            <ul className="space-y-1 rounded-md border p-3 text-sm">
              {parsedChecks.map((check) => (
                <li key={check.label} className="flex items-start gap-2">
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span>
                    <span className="font-medium">
                      {(() => {
                        const known = checkLabel(check.label);
                        return known
                          ? t(`connection.checks.${known}`)
                          : check.label;
                      })()}
                    </span>
                    : <span className="break-all">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {connection.lastTestedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("connection.lastTest", {
                date: formatSocialDate(connection.lastTestedAt, i18n.language),
              })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              pending={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {t("connection.test")}
            </Button>
            {connection.canManage ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                >
                  {t("connection.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingDisconnect(true)}
                >
                  {t("connection.disconnect")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : connection.canManage ? (
        <MetaConnectForm
          projectId={projectId}
          initial={
            connection.connected
              ? {
                  pageId: connection.pageId ?? "",
                  instagramAccountId: connection.instagramAccountId ?? "",
                  adAccountId: connection.adAccountId ?? "",
                }
              : { pageId: "", instagramAccountId: "", adAccountId: "" }
          }
          hasToken={connection.connected}
          timezone={
            isTimezone(connection.timezone) ? connection.timezone : "UTC"
          }
          onDone={async () => {
            setChecks(null);
            await refresh();
            setEditing(false);
          }}
          onCancel={connection.connected ? () => setEditing(false) : null}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("connection.noPermission")}
        </p>
      )}

      {confirmingDisconnect ? (
        <ConfirmDialog
          title={t("connection.disconnectConfirm")}
          confirmLabel={t("connection.disconnect")}
          destructive
          pending={disconnectMutation.isPending}
          onConfirm={() => disconnectMutation.mutate()}
          onClose={() => setConfirmingDisconnect(false)}
        >
          {t("connection.disconnectDescription")}
        </ConfirmDialog>
      ) : null}
    </CardShell>
  );
}

function MetaConnectForm({
  projectId,
  initial,
  hasToken,
  timezone: initialTimezone,
  onDone,
  onCancel,
}: {
  projectId: string;
  initial: { pageId: string; instagramAccountId: string; adAccountId: string };
  hasToken: boolean;
  timezone: Timezone;
  onDone: () => Promise<void>;
  onCancel: (() => void) | null;
}) {
  const { t } = useTranslation(["social", "common"]);
  const [values, setValues] = useState(initial);
  const [accessToken, setAccessToken] = useState("");
  const [timezone, setTimezone] = useState<Timezone>(initialTimezone);

  const mutation = useMutation({
    mutationFn: () =>
      connectMeta({
        data: {
          projectId,
          ...values,
          accessToken: accessToken || undefined,
          timezone,
        },
      }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      await onDone();
      toast.success(t("connection.saved"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const field = (key: keyof typeof values, id: string, hint?: string) => (
    <Field>
      <FieldLabel htmlFor={id}>{t(`connection.${key}`)}</FieldLabel>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={values[key]}
        onChange={(event) =>
          setValues((current) => ({ ...current, [key]: event.target.value }))
        }
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {field("pageId", "meta-page-id")}
        {field("instagramAccountId", "meta-ig-id")}
        {field("adAccountId", "meta-ad-id", t("connection.adAccountHint"))}
      </div>
      <Field>
        <FieldLabel htmlFor="meta-token">
          {t("connection.accessToken")}
        </FieldLabel>
        <Input
          id="meta-token"
          type="password"
          autoComplete="off"
          placeholder="EAA…"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
        />
        {hasToken ? (
          <FieldDescription>{t("connection.accessTokenKeep")}</FieldDescription>
        ) : null}
      </Field>
      <Field>
        <FieldLabel>{t("connection.timezone")}</FieldLabel>
        <Select
          items={SOCIAL_TIMEZONES.map((zone) => ({ value: zone, label: zone }))}
          value={timezone}
          onValueChange={(next) => {
            if (next !== null) setTimezone(next);
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOCIAL_TIMEZONES.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t("connection.timezoneHint")}</FieldDescription>
      </Field>
      <div className="flex gap-2">
        <Button
          type="submit"
          pending={mutation.isPending}
          disabled={!hasToken && !accessToken.trim()}
        >
          {t("connection.save")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common:actions.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function MetaSetupGuide() {
  const { t } = useTranslation("social");
  const steps = [
    t("guide.step1"),
    t("guide.step2"),
    t("guide.step3"),
    t("guide.step4"),
    t("guide.step5"),
    t("guide.step6"),
    t("guide.step7"),
    t("guide.step8"),
  ];
  return (
    <details className="rounded-lg border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        {t("guide.title")}
      </summary>
      <p className="mt-3 text-muted-foreground">{t("guide.intro")}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
