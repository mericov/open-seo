import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";

export function FloatingBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("digitalPr");
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-full border border-border bg-background py-1.5 pr-1.5 pl-4 shadow-lg">
      <span className="shrink-0 pr-2 text-sm tabular-nums">
        {t("common.selected", { count })}
      </span>
      {children}
      <Button
        size="icon-sm"
        variant="ghost"
        className="shrink-0 rounded-full"
        aria-label={t("common.clear")}
        onClick={onClear}
      >
        <X />
      </Button>
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  shown,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation("digitalPr");
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span className="tabular-nums">
        {t("common.range", {
          from: (page - 1) * pageSize + 1,
          to: (page - 1) * pageSize + shown,
          total,
        })}
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t("common.previous")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={page * pageSize >= total}
          onClick={() => onPage(page + 1)}
        >
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}

export function formatCompact(value: number | null, locale: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function toggleInSet(set: Set<string>, id: string, value: boolean) {
  const next = new Set(set);
  if (value) next.add(id);
  else next.delete(id);
  return next;
}
