import {
  Ban,
  ChevronDown,
  EyeOff,
  FileText,
  Mail,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { StatusLabel } from "@/client/features/leads/leadBadges";
import { leadSearchesOptions } from "@/client/features/leads/leadQueries";
import {
  LEAD_OUTREACH_STATUSES,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";

export function BulkBar({
  count,
  pending,
  writingLines,
  onWriteLines,
  hiding,
  onHide,
  suppressing,
  onSuppress,
  rescanning,
  onRescan,
  reporting,
  onReports,
  onStatus,
  onClear,
}: {
  count: number;
  pending: boolean;
  writingLines: boolean;
  onWriteLines: () => void;
  hiding: boolean;
  onHide: () => void;
  suppressing: boolean;
  onSuppress: () => void;
  rescanning: boolean;
  onRescan: () => void;
  reporting: boolean;
  onReports: () => void;
  onStatus: (status: LeadOutreachStatus) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("leads");
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background py-1.5 pr-1.5 pl-4 shadow-lg">
      <span className="pr-2 text-sm tabular-nums">
        {t("all.selected", { count })}
      </span>
      <Button
        size="sm"
        className="rounded-full"
        pending={pending}
        onClick={() => onStatus("contacted")}
      >
        <Mail data-icon="inline-start" />
        {t("all.markContacted")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        pending={writingLines}
        onClick={onWriteLines}
      >
        <Sparkles data-icon="inline-start" />
        {t("firstLine.write")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        pending={reporting}
        onClick={onReports}
      >
        <FileText data-icon="inline-start" />
        {t("report.bulk")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" variant="outline" className="rounded-full" />
          }
        >
          {t("all.setStatus")}
          <ChevronDown data-icon="inline-end" className="opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {LEAD_OUTREACH_STATUSES.map((option) => (
            <DropdownMenuItem key={option} onClick={() => onStatus(option)}>
              <StatusLabel status={option} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-full"
        pending={hiding}
        onClick={onHide}
      >
        <EyeOff data-icon="inline-start" />
        {t("hide.action")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-full"
        pending={suppressing}
        onClick={onSuppress}
      >
        <Ban data-icon="inline-start" />
        {t("suppress.action")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-full"
        pending={rescanning}
        onClick={onRescan}
      >
        <RefreshCw data-icon="inline-start" />
        {t("rescan.action")}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        aria-label={t("all.clear")}
        onClick={onClear}
      >
        <X />
      </Button>
    </div>
  );
}

export function FilterSelect<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T;
  options: readonly T[];
  label: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      items={options.map((option) => ({ value: option, label: label(option) }))}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger size="sm" className="min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {label(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CampaignFilter({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("leads");
  const campaignsQuery = useQuery(leadSearchesOptions(projectId));
  const labels = new Map(
    (campaignsQuery.data ?? []).map((search) => [search.id, search.label]),
  );
  if (labels.size === 0) return null;
  return (
    <FilterSelect
      value={value}
      options={["any", ...labels.keys()]}
      label={(option) =>
        option === "any" ? t("all.campaignAll") : (labels.get(option) ?? option)
      }
      onChange={onChange}
    />
  );
}
