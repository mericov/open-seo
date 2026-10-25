import { Check, ChevronDown, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { cn } from "cn";
import {
  LEAD_OUTREACH_STATUSES,
  type LeadFindingCode,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";

const STATUS_DOT: Record<LeadOutreachStatus, string> = {
  new: "bg-muted-foreground/40",
  contacted: "bg-info",
  replied: "bg-success",
  not_interested: "bg-destructive/60",
  client: "bg-primary",
};

export function ScoreBadge({ score }: { score: number | null }) {
  const { t } = useTranslation("leads");
  if (score == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const tone =
    score >= 60
      ? "bg-success/10 text-success ring-success/20"
      : score >= 30
        ? "bg-warning/10 text-warning ring-warning/20"
        : "bg-muted text-muted-foreground ring-border";
  return (
    <span
      title={t("score.hint")}
      className={cn(
        "inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ring-1 ring-inset",
        tone,
      )}
    >
      {score}
    </span>
  );
}

export function FindingChips({
  findings,
  max = 3,
}: {
  findings: LeadFindingCode[];
  max?: number;
}) {
  const { t } = useTranslation("leads");
  if (findings.length === 0) return null;
  const shown = findings.slice(0, max);
  const rest = findings.slice(max);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((code) => (
        <span
          key={code}
          className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
        >
          {t(`findings.${code}`)}
        </span>
      ))}
      {rest.length > 0 ? (
        <span
          title={rest.map((code) => t(`findings.${code}`)).join(", ")}
          className="rounded-md px-1 py-0.5 text-[11px] leading-4 text-muted-foreground"
        >
          +{rest.length}
        </span>
      ) : null}
    </div>
  );
}

export function StatusLabel({ status }: { status: LeadOutreachStatus }) {
  const { t } = useTranslation("leads");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {t(`outreach.${status}`)}
    </span>
  );
}

export function OutreachStatusMenu({
  status,
  onChange,
  disabled,
}: {
  status: LeadOutreachStatus;
  onChange: (status: LeadOutreachStatus) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 whitespace-nowrap hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <StatusLabel status={status} />
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LEAD_OUTREACH_STATUSES.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onChange(option)}>
            <StatusLabel status={option} />
            {option === status ? <Check className="ml-auto size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorContactBadge({
  prior,
}: {
  prior: {
    contactedAt: string | null;
    otherProject: boolean;
    suppressed: boolean;
  } | null;
}) {
  const { t } = useTranslation("leads");
  if (!prior) return null;
  const label = prior.suppressed
    ? t("prior.suppressed")
    : t(prior.otherProject ? "prior.contactedOther" : "prior.contacted", {
        when: prior.contactedAt ? formatRelativeTime(prior.contactedAt) : "",
      });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        prior.suppressed
          ? "bg-destructive/10 text-destructive ring-destructive/20"
          : "bg-warning/10 text-warning ring-warning/20",
      )}
    >
      <History className="size-3" />
      {label}
    </span>
  );
}
