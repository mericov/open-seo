import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { SocialPostEditor } from "@/client/features/social/SocialPostEditor";
import type { SocialPostView } from "@/client/features/social/SocialPostEditorParts";
import {
  metaConnectionOptions,
  socialQueryKey,
} from "@/client/features/social/socialQueries";
import {
  approveSocialPosts,
  listSocialPosts,
  rescheduleSocialPost,
} from "@/serverFunctions/social";
import { utcToZoned, zonedToUtcIso } from "@/shared/socialTime";
import { cn } from "cn";

type View = "week" | "month";

const STATUS_STYLES: Record<SocialPostView["status"], string> = {
  draft: "border-dashed border-muted-foreground/40 bg-background",
  approved: "border-sky-500/50 bg-sky-500/10",
  scheduled: "border-indigo-500/50 bg-indigo-500/10",
  publishing: "border-amber-500/50 bg-amber-500/10",
  published: "border-emerald-500/50 bg-emerald-500/10",
  failed: "border-destructive/60 bg-destructive/10",
};

const MOVABLE = new Set(["draft", "approved", "scheduled", "failed"]);
const SELECTABLE = new Set(["draft", "failed"]);

function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(day: string) {
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

function visibleDays(anchor: string, view: View) {
  if (view === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const start = startOfWeek(first);
  const lastOfMonth = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1);
  const days: string[] = [];
  for (let day = start; days.length < 42; day = addDays(day, 1)) {
    days.push(day);
    if (day >= lastOfMonth && days.length % 7 === 0) break;
  }
  return days;
}

export function SocialCalendar({
  projectId,
  languageCode,
}: {
  projectId: string;
  languageCode: string;
}) {
  const { t, i18n } = useTranslation("social");
  const queryClient = useQueryClient();
  const meta = useQuery(metaConnectionOptions(projectId)).data;
  const timezone = meta?.timezone ?? "UTC";
  const today = utcToZoned(new Date().toISOString(), timezone).day;
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{
    post: SocialPostView | null;
    day: string | null;
  } | null>(null);
  const days = useMemo(() => visibleDays(anchor, view), [anchor, view]);
  const from = zonedToUtcIso(days[0] ?? today, "00:00", timezone);
  const to = zonedToUtcIso(days.at(-1) ?? today, "23:59", timezone);

  const postsQuery = useQuery({
    queryKey: [...socialQueryKey(projectId), "posts", from, to],
    queryFn: () => listSocialPosts({ data: { projectId, from, to } }),
    enabled: Boolean(meta),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: socialQueryKey(projectId) });

  const byDay = useMemo(() => {
    const map = new Map<string, SocialPostView[]>();
    for (const post of postsQuery.data?.scheduled ?? []) {
      if (!post.scheduledAt) continue;
      const day = utcToZoned(post.scheduledAt, timezone).day;
      map.set(day, [...(map.get(day) ?? []), post]);
    }
    return map;
  }, [postsQuery.data, timezone]);

  const move = useMutation({
    mutationFn: ({ post, day }: { post: SocialPostView; day: string }) => {
      const time = post.scheduledAt
        ? utcToZoned(post.scheduledAt, timezone).time
        : "19:00";
      return rescheduleSocialPost({
        data: {
          projectId,
          postId: post.id,
          scheduledAt: zonedToUtcIso(day, time, timezone),
        },
      });
    },
    onSuccess: async (response) => {
      if (!response.ok) toast.error(response.message);
      else toast.success(t("calendar.moved"));
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const approve = useMutation({
    mutationFn: () =>
      approveSocialPosts({ data: { projectId, postIds: [...selected] } }),
    onSuccess: async (results) => {
      const done = results.filter((row) => !row.error);
      const skipped = results.filter((row) => row.error);
      if (done.length > 0)
        toast.success(t("calendar.approved", { count: done.length }));
      if (skipped.length > 0)
        toast.error(
          t("calendar.approveSkipped", {
            count: skipped.length,
            reasons: [...new Set(skipped.map((row) => row.error))].join("; "),
          }),
        );
      setSelected(new Set());
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const allPosts = [
    ...(postsQuery.data?.scheduled ?? []),
    ...(postsQuery.data?.unscheduled ?? []),
  ];
  const onDrop = (day: string, postId: string) => {
    const post = allPosts.find((row) => row.id === postId);
    if (post && MOVABLE.has(post.status)) move.mutate({ post, day });
  };
  const shift = (direction: number) =>
    setAnchor((current) =>
      view === "week"
        ? addDays(current, direction * 7)
        : `${addDays(`${current.slice(0, 7)}-15`, direction * 30).slice(0, 7)}-01`,
    );
  const label = new Date(`${anchor}T12:00:00Z`).toLocaleDateString(
    i18n.language,
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );

  const chip = (post: SocialPostView) => {
    const time = post.scheduledAt
      ? utcToZoned(post.scheduledAt, timezone).time
      : "";
    return (
      <div
        key={post.id}
        draggable={MOVABLE.has(post.status)}
        onDragStart={(event) =>
          event.dataTransfer.setData("text/plain", post.id)
        }
        className={cn(
          "flex items-start gap-1 rounded border px-1.5 py-1 text-xs",
          STATUS_STYLES[post.status],
        )}
      >
        {SELECTABLE.has(post.status) ? (
          <input
            type="checkbox"
            className="mt-0.5"
            aria-label={post.title}
            checked={selected.has(post.id)}
            onChange={(event) =>
              setSelected((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(post.id);
                else next.delete(post.id);
                return next;
              })
            }
          />
        ) : null}
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setEditing({ post, day: null })}
        >
          <span className="block truncate font-medium">
            {time ? `${time} ` : ""}
            {post.platform === "instagram" ? "IG" : "FB"} · {post.title}
          </span>
          <span className="block truncate text-muted-foreground">
            {t(`status.${post.status}`)} · {t(`format.${post.format}`)}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {meta && !meta.connected ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {t("calendar.noConnection")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-label={t("calendar.previous")}
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>
          {t("calendar.today")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={t("calendar.next")}
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="ml-2 text-lg font-semibold capitalize">{label}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SegmentedToggle
            showLabels
            value={view}
            onChange={setView}
            items={(["week", "month"] as const).map((value) => ({
              value,
              icon: null,
              label: t(`calendar.${value}`),
            }))}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            pending={approve.isPending}
            onClick={() => approve.mutate()}
          >
            {t("calendar.approveSelected", { count: selected.size })}
          </Button>
          <Button
            size="sm"
            onClick={() => setEditing({ post: null, day: null })}
          >
            <Plus className="size-4" />
            {t("calendar.newPost")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("calendar.timezoneNote", { timezone })} {t("calendar.legend")}
      </p>
      {postsQuery.isPending ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
          {days.slice(0, 7).map((day) => (
            <div
              key={`head-${day}`}
              className="bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
            >
              {new Date(`${day}T12:00:00Z`).toLocaleDateString(i18n.language, {
                weekday: "short",
                timeZone: "UTC",
              })}
            </div>
          ))}
          {days.map((day) => {
            const outside =
              view === "month" && day.slice(0, 7) !== anchor.slice(0, 7);
            return (
              <div
                key={day}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onDrop(day, event.dataTransfer.getData("text/plain"));
                }}
                onDoubleClick={() => setEditing({ post: null, day })}
                className={cn(
                  "space-y-1 bg-background p-1.5",
                  view === "week" ? "min-h-80" : "min-h-28",
                  outside && "bg-muted/40",
                )}
              >
                <p
                  className={cn(
                    "text-xs",
                    day === today
                      ? "font-bold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </p>
                {(byDay.get(day) ?? []).map(chip)}
              </div>
            );
          })}
        </div>
      )}
      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium">{t("calendar.unscheduled")}</p>
        <p className="mb-2 text-xs text-muted-foreground">
          {t("calendar.unscheduledHint")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(postsQuery.data?.unscheduled ?? []).map(chip)}
        </div>
      </div>
      {editing ? (
        <SocialPostEditor
          projectId={projectId}
          post={editing.post}
          timezone={timezone}
          defaultLanguage={languageCode}
          defaultDay={editing.day}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
