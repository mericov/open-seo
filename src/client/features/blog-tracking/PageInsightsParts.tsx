import { CheckCircle2, CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/client/components/ui/badge";
import type { PageInsights } from "@/client/features/blog-tracking/blogTrackingQueries";
import { formatNumber } from "@/i18n/format";
import { GEO_CHECK_IDS } from "@/shared/pageTracking";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number | null;
  invert?: boolean;
}) {
  const { t } = useTranslation("blogTracking");
  if (previous === null)
    return <span className="text-xs text-info">{t("queries.newKeyword")}</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5)
    return <span className="text-muted-foreground">–</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={good ? "text-success" : "text-destructive"}>
      {formatNumber(diff, {
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      })}
    </span>
  );
}

export function KeywordTable({
  keywords,
}: {
  keywords: PageInsights["keywords"];
}) {
  const { t } = useTranslation("blogTracking");
  if (keywords.length === 0)
    return (
      <p className="text-sm text-muted-foreground">{t("queries.empty")}</p>
    );
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 font-medium">{t("queries.query")}</th>
            <th
              className="py-1 pl-2 text-right font-medium"
              title={t("queries.volumeHint")}
            >
              {t("queries.volume")}
            </th>
            <th className="py-1 pl-2 text-right font-medium">
              {t("columns.clicks")}
            </th>
            <th className="py-1 pl-2 text-right font-medium">±</th>
            <th className="py-1 pl-2 text-right font-medium">
              {t("columns.impressions")}
            </th>
            <th className="py-1 pl-2 text-right font-medium">
              {t("columns.position")}
            </th>
            <th className="py-1 pl-2 text-right font-medium">±</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((row) => (
            <tr key={row.query} className="border-t border-border/60">
              <td className="py-1.5 pr-3">{row.query}</td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                {row.searchVolume === null ? (
                  <span className="text-muted-foreground">–</span>
                ) : (
                  formatNumber(row.searchVolume)
                )}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                {formatNumber(row.clicks)}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                <Delta current={row.clicks} previous={row.previousClicks} />
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                {formatNumber(row.impressions)}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                {formatNumber(row.position, { maximumFractionDigits: 1 })}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                <Delta
                  current={row.position}
                  previous={row.previousPosition}
                  invert
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TodoItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>{children}</span>
    </li>
  );
}

export function ChecksList({
  checks,
  geo,
}: {
  checks: PageInsights["checks"];
  geo: boolean;
}) {
  const { t } = useTranslation("blogTracking");
  const list = checks.filter(
    (check) => GEO_CHECK_IDS.includes(check.id) === geo,
  );
  const failed = list.filter((check) => !check.ok);
  const passed = list.length - failed.length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t("checks.score", { passed, total: list.length })}
      </p>
      {failed.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" />
          {t("checks.allGood")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {failed.map((check) => (
            <TodoItem key={check.id}>
              {t(`checks.${check.id}`, { value: check.value ?? 0 })}
            </TodoItem>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LinkList({
  links,
}: {
  links: PageInsights["links"]["outbound"];
}) {
  const { t } = useTranslation("blogTracking");
  return (
    <ul className="space-y-1">
      {links.map((link) => (
        <li key={link.url} className="flex items-center gap-2 text-sm">
          <Badge variant="outline" size="sm">
            {t(`linkKinds.${link.kind}`)}
          </Badge>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="truncate hover:underline"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function AdviceBlock({
  advice,
}: {
  advice: NonNullable<PageInsights["advice"]>;
}) {
  const { t } = useTranslation("blogTracking");
  return (
    <div className="space-y-3 text-sm">
      <p>{advice.summary}</p>
      {advice.titles.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("advice.titles")}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {advice.titles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {advice.metaDescriptions.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("advice.metaDescriptions")}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {advice.metaDescriptions.map((meta) => (
              <li key={meta}>{meta}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {advice.actions.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("advice.actions")}
          </p>
          <ol className="space-y-1.5">
            {advice.actions.map((action, index) => (
              <li key={`${action.area}-${index}`} className="flex gap-2">
                <Badge variant="soft" size="sm" className="mt-0.5">
                  {t(`advice.areas.${action.area}`)}
                </Badge>
                <span>{action.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {advice.faqQuestions.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("advice.faq")}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {advice.faqQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
