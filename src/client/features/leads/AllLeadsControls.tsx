import { ChevronDown, Mail, X } from "lucide-react";
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
import {
  LEAD_OUTREACH_STATUSES,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";

export function BulkBar({
  count,
  pending,
  onStatus,
  onClear,
}: {
  count: number;
  pending: boolean;
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
