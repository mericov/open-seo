import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { CardShell } from "@/client/components/CardShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  formatShopifyDate,
  shopifyConnectionOptions,
  shopifyQueryKey,
} from "@/client/features/shopify/shopifyQueries";
import { connectShopify, disconnectShopify } from "@/serverFunctions/shopify";
import {
  SHOPIFY_RECOMMENDED_SCOPES,
  type ShopifyAuthMode,
} from "@/shared/shopify";

export function ShopifyConnectionCard({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("shopify");
  const queryClient = useQueryClient();
  const connectionQuery = useQuery(shopifyConnectionOptions(projectId));
  const [editing, setEditing] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: shopifyQueryKey(projectId) });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectShopify({ data: { projectId } }),
    onSuccess: async () => {
      await refresh();
      setConfirmingDisconnect(false);
      toast.success(t("connection.disconnected"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const connection = connectionQuery.data;

  return (
    <CardShell
      title={t("connection.title")}
      icon={<ShoppingBag className="size-4" />}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {t("connection.description")}
      </p>
      {!connection ? (
        <Skeleton className="h-24" />
      ) : connection.connected && !editing ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">
              {t("connection.connected", {
                shop: connection.shopName ?? connection.shopDomain,
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {connection.shopDomain}
              {connection.primaryDomain
                ? ` · ${connection.primaryDomain}`
                : ""}{" "}
              ·{" "}
              {t("connection.connectedSince", {
                date: formatShopifyDate(connection.connectedAt, i18n.language),
              })}
            </p>
          </div>
          {connection.missingScopes.length > 0 ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {t("connection.missingScopes", {
                scopes: connection.missingScopes.join(", "),
              })}
            </p>
          ) : null}
          {connection.canManage ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                {t("connection.reconnect")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDisconnect(true)}
              >
                {t("connection.disconnect")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : connection.canManage ? (
        <ShopifyConnectForm
          projectId={projectId}
          initialDomain={connection.connected ? connection.shopDomain : ""}
          onDone={async () => {
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

function ShopifyConnectForm({
  projectId,
  initialDomain,
  onDone,
  onCancel,
}: {
  projectId: string;
  initialDomain: string;
  onDone: () => Promise<void>;
  onCancel: (() => void) | null;
}) {
  const { t } = useTranslation(["shopify", "common"]);
  const [shopDomain, setShopDomain] = useState(initialDomain);
  const [authMode, setAuthMode] =
    useState<ShopifyAuthMode>("client_credentials");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      connectShopify({
        data: {
          projectId,
          shopDomain,
          authMode,
          ...(authMode === "client_credentials"
            ? { clientId, clientSecret }
            : { accessToken }),
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

  const ready =
    shopDomain.trim() &&
    (authMode === "client_credentials"
      ? clientId.trim() && clientSecret.trim()
      : accessToken.trim());

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) mutation.mutate();
      }}
    >
      <Field>
        <FieldLabel htmlFor="shopify-domain">
          {t("connection.shopDomain")}
        </FieldLabel>
        <Input
          id="shopify-domain"
          placeholder="my-store.myshopify.com"
          value={shopDomain}
          onChange={(event) => setShopDomain(event.target.value)}
        />
        <FieldDescription>{t("connection.shopDomainHint")}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>{t("connection.mode")}</FieldLabel>
        <div>
          <SegmentedToggle
            showLabels
            value={authMode}
            onChange={setAuthMode}
            items={[
              {
                value: "client_credentials",
                icon: null,
                label: t("connection.modeClient"),
              },
              {
                value: "access_token",
                icon: null,
                label: t("connection.modeToken"),
              },
            ]}
          />
        </div>
        <FieldDescription>
          {authMode === "client_credentials"
            ? t("connection.modeClientHint")
            : t("connection.modeTokenHint")}
        </FieldDescription>
      </Field>

      {authMode === "client_credentials" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="shopify-client-id">
              {t("connection.clientId")}
            </FieldLabel>
            <Input
              id="shopify-client-id"
              autoComplete="off"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="shopify-client-secret">
              {t("connection.clientSecret")}
            </FieldLabel>
            <Input
              id="shopify-client-secret"
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
            />
          </Field>
        </div>
      ) : (
        <Field>
          <FieldLabel htmlFor="shopify-access-token">
            {t("connection.accessToken")}
          </FieldLabel>
          <Input
            id="shopify-access-token"
            type="password"
            autoComplete="off"
            placeholder="shpat_…"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
        </Field>
      )}

      <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <p className="mb-1">{t("connection.scopesHint")}</p>
        <p className="font-mono">{SHOPIFY_RECOMMENDED_SCOPES.join(", ")}</p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" pending={mutation.isPending} disabled={!ready}>
          {t("connection.connect")}
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
