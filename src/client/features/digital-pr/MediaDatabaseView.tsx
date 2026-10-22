import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, ListPlus, Plus, RefreshCw, Library } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Switch } from "@/client/components/ui/switch";
import { useDebouncedDraft } from "@/client/hooks/useDebouncedDraft";
import { FilterSelect } from "@/client/features/leads/AllLeadsControls";
import {
  AddOutletDialog,
  ContactEditDialog,
  OutletEditDialog,
} from "@/client/features/digital-pr/MediaDialogs";
import { MediaOutletRow } from "@/client/features/digital-pr/MediaOutletRow";
import { useMediaActions } from "@/client/features/digital-pr/useMediaActions";
import { MediaScanPanel } from "@/client/features/digital-pr/MediaScanPanel";
import {
  FloatingBar,
  Pager,
  toggleInSet,
} from "@/client/features/digital-pr/PrControls";
import {
  mediaOutletsOptions,
  mediaOverviewOptions,
  type MediaContact,
  type MediaOutlet,
  type OutletFilters,
} from "@/client/features/digital-pr/prQueries";
import {
  MEDIA_OUTLET_TYPES,
  PR_MARKETS,
  type MediaOutletType,
  type PrMarket,
} from "@/shared/digitalPr";
const PAGE_SIZE = 50;
const TRAFFIC_OPTIONS = ["any", "1000", "10000", "100000"] as const;

type ContactEdit = { outlet: MediaOutlet; contact: MediaContact | null };

export function MediaDatabaseView({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("digitalPr");
  const overviewQuery = useQuery(mediaOverviewOptions(projectId));
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<PrMarket | "any">("any");
  const [type, setType] = useState<MediaOutletType | "any">("any");
  const [topicId, setTopicId] = useState("any");
  const [traffic, setTraffic] =
    useState<(typeof TRAFFIC_OPTIONS)[number]>("any");
  const [hasEmail, setHasEmail] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MediaOutlet | null>(null);
  const [contactEdit, setContactEdit] = useState<ContactEdit | null>(null);
  const [adding, setAdding] = useState(false);

  const filters: OutletFilters = {
    query: query.trim() || undefined,
    market: market === "any" ? undefined : market,
    type: type === "any" ? undefined : type,
    topicId: topicId === "any" ? undefined : topicId,
    minTraffic: traffic === "any" ? undefined : Number(traffic),
    hasEmail: hasEmail || undefined,
    showHidden: showHidden || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const outletsQuery = useQuery(mediaOutletsOptions(projectId, filters));

  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };
  const [queryDraft, setQueryDraft] = useDebouncedDraft(query, (value) => {
    setQuery(value);
    resetPaging();
  });
  const { addMutation, hideMutation, rescanMutation, hideContactMutation } =
    useMediaActions(projectId, () => setSelected(new Set()));

  const data = outletsQuery.data;
  const pageIds = data?.outlets.map((outlet) => outlet.id) ?? [];
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const topics = overviewQuery.data?.topics ?? [];
  const busy = addMutation.isPending;

  return (
    <div className="space-y-6">
      <MediaScanPanel projectId={projectId} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder={t("media.search")}
            className="w-56"
          />
          <FilterSelect
            value={market}
            options={["any", ...PR_MARKETS] as const}
            label={(value) =>
              value === "any" ? t("media.allMarkets") : t(`markets.${value}`)
            }
            onChange={(value) => {
              setMarket(value);
              resetPaging();
            }}
          />
          <FilterSelect
            value={type}
            options={["any", ...MEDIA_OUTLET_TYPES] as const}
            label={(value) =>
              value === "any" ? t("media.allTypes") : t(`types.${value}`)
            }
            onChange={(value) => {
              setType(value);
              resetPaging();
            }}
          />
          {topics.length > 0 ? (
            <FilterSelect
              value={topicId}
              options={["any", ...topics.map((topic) => topic.id)]}
              label={(value) =>
                value === "any"
                  ? t("media.allTopics")
                  : (topics.find((topic) => topic.id === value)?.keyword ??
                    value)
              }
              onChange={(value) => {
                setTopicId(value);
                resetPaging();
              }}
            />
          ) : null}
          <FilterSelect
            value={traffic}
            options={TRAFFIC_OPTIONS}
            label={(value) =>
              value === "any"
                ? t("media.anyTraffic")
                : t("media.minTraffic", {
                    value: Number(value).toLocaleString(i18n.language),
                  })
            }
            onChange={(value) => {
              setTraffic(value);
              resetPaging();
            }}
          />
          <label className="inline-flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Switch
              checked={hasEmail}
              onCheckedChange={(value) => {
                setHasEmail(value);
                resetPaging();
              }}
            />
            {t("media.hasEmail")}
          </label>
          <Button
            size="sm"
            variant={showHidden ? "default" : "ghost"}
            aria-pressed={showHidden}
            onClick={() => {
              setShowHidden(!showHidden);
              resetPaging();
            }}
          >
            {showHidden ? (
              <Eye data-icon="inline-start" />
            ) : (
              <EyeOff data-icon="inline-start" />
            )}
            {t("media.showHidden")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setAdding(true)}
          >
            <Plus data-icon="inline-start" />
            {t("media.addOutlet")}
          </Button>
        </div>

        {outletsQuery.isPending ? (
          <SkeletonPage />
        ) : outletsQuery.isError ? (
          <QueryError
            error={outletsQuery.error}
            fallback={t("common.loadFailed")}
            onRetry={() => void outletsQuery.refetch()}
            isRetrying={outletsQuery.isFetching}
          />
        ) : data && data.outlets.length === 0 ? (
          <EmptyState
            icon={Library}
            title={t("media.emptyTitle")}
            description={t("media.emptyDescription")}
          />
        ) : data ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="w-10 py-3 pr-0 pl-4 font-normal">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(value) =>
                          setSelected(value ? new Set(pageIds) : new Set())
                        }
                        aria-label={t("common.selectAll")}
                      />
                    </th>
                    <th className="py-3 pr-4 pl-1 font-normal">
                      {t("media.columns.outlet")}
                    </th>
                    <th className="py-3 pr-4 font-normal">
                      {t("media.columns.traffic")}
                    </th>
                    <th className="py-3 pr-4 font-normal">
                      {t("media.columns.contacts")}
                    </th>
                    <th className="py-3 pr-4 text-right font-normal">
                      {t("media.columns.action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.outlets.map((outlet) => (
                    <MediaOutletRow
                      key={outlet.id}
                      outlet={outlet}
                      locale={i18n.language}
                      selected={selected.has(outlet.id)}
                      onSelect={(value) =>
                        setSelected((current) =>
                          toggleInSet(current, outlet.id, value),
                        )
                      }
                      busy={busy}
                      onAddOutlet={() =>
                        addMutation.mutate({
                          outletIds: [outlet.id],
                          contactIds: [],
                        })
                      }
                      onAddContact={(contact) =>
                        addMutation.mutate({
                          outletIds: [],
                          contactIds: [contact.id],
                        })
                      }
                      onEditOutlet={() => setEditing(outlet)}
                      onEditContact={(contact) =>
                        setContactEdit({ outlet, contact })
                      }
                      onNewContact={() =>
                        setContactEdit({ outlet, contact: null })
                      }
                      onHideContact={(contact) =>
                        hideContactMutation.mutate(contact.id)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              shown={data.outlets.length}
              total={data.total}
              onPage={(next) => {
                setPage(next);
                setSelected(new Set());
              }}
            />
          </>
        ) : null}
      </section>

      {selected.size > 0 ? (
        <FloatingBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
        >
          <Button
            size="sm"
            className="rounded-full"
            pending={addMutation.isPending}
            onClick={() =>
              addMutation.mutate({ outletIds: [...selected], contactIds: [] })
            }
          >
            <ListPlus data-icon="inline-start" />
            {t("common.addToList")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            pending={rescanMutation.isPending}
            onClick={() => rescanMutation.mutate([...selected])}
          >
            <RefreshCw data-icon="inline-start" />
            {t("media.rescan")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            pending={hideMutation.isPending}
            onClick={() =>
              hideMutation.mutate({
                outletIds: [...selected],
                hidden: !showHidden,
              })
            }
          >
            {showHidden ? (
              <Eye data-icon="inline-start" />
            ) : (
              <EyeOff data-icon="inline-start" />
            )}
            {showHidden ? t("common.unhide") : t("common.hide")}
          </Button>
        </FloatingBar>
      ) : null}

      {editing ? (
        <OutletEditDialog
          projectId={projectId}
          outlet={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {contactEdit ? (
        <ContactEditDialog
          projectId={projectId}
          outlet={contactEdit.outlet}
          contact={contactEdit.contact}
          onClose={() => setContactEdit(null)}
        />
      ) : null}
      {adding ? (
        <AddOutletDialog
          projectId={projectId}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}
