import { useMemo } from "react";
import {
  createColumnHelper,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import {
  DataTable,
  makeSelectionColumn,
  useDataTable,
  useSelectionAnchor,
} from "@/client/components/table/DataTable";
import {
  IntentBadge,
  type SortDir,
  type SortField,
} from "@/client/features/keywords/components";
import { SortableHeader } from "@/client/components/table/SortableHeader";
import { ScoreBadge } from "@/client/components/table/ScoreBadge";
import { formatNumber } from "@/client/features/keywords/utils";
import type { KeywordResearchDisplayRow } from "@/client/features/keywords/groupSharedVolumeRows";
import type { KeywordResearchRow } from "@/types/keywords";
import { useTranslation } from "react-i18next";
import { Badge } from "@/client/components/ui/badge";
import { keywordOpportunity } from "@/shared/keywordOpportunity";

type Props = {
  filteredRows: KeywordResearchDisplayRow[];
  overviewKeyword: KeywordResearchRow | null;
  selectedRows: Set<string>;
  setSelectedRows: (rows: Set<string>) => void;
  sortDir: SortDir;
  sortField: SortField;
  toggleSort: (field: SortField) => void;
  isFiltered: boolean;
  resetFilters: () => void;
  handleRowClick: (row: KeywordResearchRow) => void;
  toolbar: ReactNode;
  footer: ReactNode;
  savedKeywords: Set<string>;
};

const keywordColumnHelper = createColumnHelper<KeywordResearchDisplayRow>();

const opportunityClass = (score: number) =>
  score >= 60
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    : score >= 40
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
      : "bg-muted text-muted-foreground";

export function KeywordResearchTable({
  filteredRows,
  overviewKeyword,
  selectedRows,
  setSelectedRows,
  sortDir,
  sortField,
  toggleSort,
  isFiltered,
  resetFilters,
  handleRowClick,
  toolbar,
  footer,
  savedKeywords,
}: Props) {
  const { t } = useTranslation();
  const selectAnchorRef = useSelectionAnchor();
  const rowSelection = useMemo<RowSelectionState>(
    () =>
      Object.fromEntries(
        [...selectedRows].map((keyword) => [keyword, true]),
      ) as RowSelectionState,
    [selectedRows],
  );
  const columns = useMemo<ColumnDef<KeywordResearchDisplayRow>[]>(() => {
    // The controller sorts the rows, so each header reads and sets its sort.
    const sortColumn = (field: SortField) => ({
      getIsSorted: () => (field === sortField ? sortDir : false),
      getToggleSortingHandler: () => () => toggleSort(field),
    });
    return [
      makeSelectionColumn<KeywordResearchDisplayRow>(selectAnchorRef),
      keywordColumnHelper.accessor("keyword", {
        header: () => (
          <SortableHeader
            column={sortColumn("keyword")}
            label="Keyword"
            className="min-w-48 md:min-w-0"
          />
        ),
        cell: ({ row }) => (
          <div
            className={`min-w-48 md:min-w-0 ${row.original.parentKeyword ? "pl-4" : ""}`}
          >
            <span
              className={`block whitespace-normal break-words capitalize md:truncate ${row.original.parentKeyword ? "font-normal" : "font-medium"}`}
              title={
                row.original.parentKeyword
                  ? `${row.original.keyword}: matching reported volume with ${row.original.parentKeyword}. Shared volumes may overlap.`
                  : row.original.keyword
              }
            >
              {savedKeywords.has(row.original.keyword) ? (
                <Badge
                  variant="secondary"
                  className="mr-1.5 align-middle normal-case"
                  title={t("keywordResearch.savedHint")}
                >
                  {t("keywordResearch.saved")}
                </Badge>
              ) : null}
              {row.original.keyword}
            </span>
          </div>
        ),
        // From md, the keyword column takes the free width and truncates, so
        // the metric columns stay in view.
        meta: {
          headerClassName: "min-w-48 md:w-full md:max-w-0 md:min-w-0",
          cellClassName: "min-w-48 md:w-full md:max-w-0 md:min-w-0",
        },
      }),
      keywordColumnHelper.accessor("searchVolume", {
        header: () => (
          <SortableHeader
            column={sortColumn("searchVolume")}
            label="Volume"
            align="right"
          />
        ),
        cell: ({ row, getValue }) =>
          row.original.parentKeyword ? null : formatNumber(getValue()),
        meta: {
          headerClassName: "text-right",
          cellClassName:
            "whitespace-nowrap text-right tabular-nums text-muted-foreground",
        },
      }),
      keywordColumnHelper.accessor("cpc", {
        header: () => (
          <SortableHeader
            column={sortColumn("cpc")}
            label="CPC"
            helpText="Cost per click in USD."
            align="right"
          />
        ),
        cell: ({ row, getValue }) => {
          if (row.original.parentKeyword) return null;
          const value = getValue();
          return value == null ? "-" : value.toFixed(2);
        },
        meta: {
          headerClassName: "text-right",
          cellClassName:
            "whitespace-nowrap text-right tabular-nums text-muted-foreground",
        },
      }),
      keywordColumnHelper.accessor("competition", {
        header: () => (
          <SortableHeader
            column={sortColumn("competition")}
            label="Comp."
            helpText="Paid-search competition from Google Ads (0-1): higher means more advertisers bidding."
            align="right"
          />
        ),
        cell: ({ row, getValue }) => {
          if (row.original.parentKeyword) return null;
          const value = getValue();
          return value == null ? "-" : value.toFixed(2);
        },
        meta: {
          headerClassName: "text-right",
          cellClassName:
            "whitespace-nowrap text-right tabular-nums text-muted-foreground",
        },
      }),
      keywordColumnHelper.accessor("keywordDifficulty", {
        header: () => (
          <SortableHeader
            column={sortColumn("keywordDifficulty")}
            label="Score"
            helpText="Organic ranking difficulty (0-100): higher means harder to reach Google's top 10."
            align="right"
          />
        ),
        cell: ({ getValue }) => <ScoreBadge value={getValue()} />,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      }),
      keywordColumnHelper.display({
        id: "opportunity",
        header: () => (
          <SortableHeader
            column={sortColumn("opportunity")}
            label={t("keywordResearch.opportunity")}
            helpText={t("keywordResearch.opportunityHelp")}
            align="right"
          />
        ),
        cell: ({ row }) => {
          const score = keywordOpportunity(row.original);
          return (
            <span
              className={`inline-block min-w-9 rounded-full px-2 py-0.5 text-center text-xs font-medium tabular-nums ${opportunityClass(score)}`}
            >
              {score}
            </span>
          );
        },
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      }),
      keywordColumnHelper.accessor("intent", {
        header: "Intent",
        cell: ({ getValue }) => <IntentBadge intent={getValue()} />,
        meta: {
          headerClassName: "text-center",
          cellClassName: "whitespace-nowrap text-center",
        },
      }),
    ];
  }, [savedKeywords, selectAnchorRef, sortDir, sortField, t, toggleSort]);
  const table = useDataTable({
    data: filteredRows,
    columns,
    state: { rowSelection },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setSelectedRows(
        new Set(
          Object.entries(next)
            .filter(([, selected]) => selected)
            .map(([keyword]) => keyword),
        ),
      );
    },
    getRowId: (row) => row.keyword,
    enableRowSelection: true,
  });

  return (
    <DataTable
      table={table}
      toolbar={toolbar}
      footer={footer}
      empty={{ title: "No keywords" }}
      isFiltered={isFiltered}
      onClearFilters={resetFilters}
      onRowClick={(row) => handleRowClick(row.original)}
      activeRowId={overviewKeyword?.keyword}
    />
  );
}
