import { Bot, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RowActionsMenu } from "@/client/components/RowActionsMenu";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { DropdownMenuItem } from "@/client/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/client/components/ui/table";
import { PageInsightsPanel } from "@/client/features/blog-tracking/PageInsightsPanel";
import type { BlogPostRow } from "@/client/features/blog-tracking/blogTrackingQueries";
import { formatNumber } from "@/i18n/format";
import type {
  BlogPostStatus,
  BlogTrackingDateRange,
} from "@/types/schemas/blog-tracking";

const STATUS_VARIANTS: Record<
  BlogPostStatus,
  "info" | "success" | "secondary" | "destructive" | "outline"
> = {
  new: "info",
  rising: "success",
  stable: "secondary",
  declining: "destructive",
  no_data: "outline",
};

export function postLabel(post: BlogPostRow) {
  if (post.title) return post.title;
  try {
    const { pathname } = new URL(post.url);
    return decodeURI(pathname);
  } catch {
    return post.url;
  }
}

function ChangeValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">–</span>;
  const percent = formatNumber(value, {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  });
  const tone =
    value > 0.05 ? "text-success" : value < -0.05 ? "text-destructive" : "";
  return <span className={tone}>{percent}</span>;
}

export function BlogPostTableRow({
  post,
  isOpen,
  connected,
  projectId,
  dateRange,
  onToggle,
  onEdit,
  onRemove,
}: {
  post: BlogPostRow;
  isOpen: boolean;
  connected: boolean;
  projectId: string;
  dateRange: BlogTrackingDateRange;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("blogTracking");
  return (
    <>
      <TableRow id={`page-row-${post.id}`} className="scroll-mt-4">
        <TableCell>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-expanded={isOpen}
            aria-label={isOpen ? t("row.hideQueries") : t("row.showQueries")}
            onClick={onToggle}
          >
            {isOpen ? <ChevronDown /> : <ChevronRight />}
          </Button>
        </TableCell>
        <TableCell className="max-w-80">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{postLabel(post)}</span>
            {post.source === "auto" ? (
              <Badge variant="outline" size="sm">
                {t("row.auto")}
              </Badge>
            ) : null}
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              aria-label={t("row.openPost")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          {post.title ? (
            <p className="truncate text-xs text-muted-foreground">{post.url}</p>
          ) : null}
        </TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANTS[post.status]}>
            {t(`status.${post.status}`)}
          </Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatNumber(post.current?.clicks ?? 0)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          <ChangeValue value={post.clicksChange} />
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatNumber(post.current?.impressions ?? 0)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {post.current
            ? formatNumber(post.current.ctr, {
                style: "percent",
                maximumFractionDigits: 1,
              })
            : "–"}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {post.current?.impressions
            ? formatNumber(post.current.position, {
                maximumFractionDigits: 1,
              })
            : "–"}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {post.aiReferral || post.aiCitations ? (
            <span
              className="inline-flex items-center gap-1"
              title={t("row.aiTitle", {
                sessions: post.aiReferral?.sessions ?? 0,
                citations: post.aiCitations?.count ?? 0,
              })}
            >
              <Bot className="size-3.5 text-muted-foreground" />
              {formatNumber(post.aiReferral?.sessions ?? 0)}
              {post.aiCitations ? (
                <Badge variant="info" size="sm">
                  {post.aiCitations.count}
                </Badge>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">–</span>
          )}
        </TableCell>
        <TableCell>
          {post.targetKeyword ? (
            <div>
              <p className="truncate text-sm">{post.targetKeyword}</p>
              <p className="text-xs text-muted-foreground">
                {post.targetKeywordPosition !== null
                  ? t("positionValue", {
                      position: formatNumber(post.targetKeywordPosition, {
                        maximumFractionDigits: 1,
                      }),
                    })
                  : connected
                    ? t("notRanking")
                    : "–"}
              </p>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t("noTarget")}
            </span>
          )}
        </TableCell>
        <TableCell>
          <RowActionsMenu
            label={t("row.actionsFor", {
              title: postLabel(post),
            })}
          >
            <DropdownMenuItem onClick={onEdit}>
              {t("row.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              {t("row.remove")}
            </DropdownMenuItem>
          </RowActionsMenu>
        </TableCell>
      </TableRow>
      {isOpen ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={11} className="p-0 whitespace-normal">
            <PageInsightsPanel
              projectId={projectId}
              post={post}
              dateRange={dateRange}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
