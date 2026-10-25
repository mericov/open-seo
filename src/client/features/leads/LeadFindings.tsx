import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { FindingChips } from "@/client/features/leads/leadBadges";
import { cn } from "cn";
import type { LeadEmailLanguage } from "@/shared/leadEmail";
import { findingBullets } from "@/shared/leadFindingPhrases";
import {
  LEAD_FINDING_CATEGORIES,
  LEAD_FINDING_META,
  type LeadFindingCode,
  type LeadFindingSeverity,
} from "@/shared/leadFindings";

const SEVERITY_DOT: Record<LeadFindingSeverity, string> = {
  critical: "bg-destructive",
  important: "bg-amber-500",
  low: "bg-muted-foreground/40",
};

const DETAIL_FORMATS = new Set([
  "thin_content",
  "h1_issue",
  "few_reviews",
  "few_photos",
  "too_many_scripts",
  "weak_title",
  "low_rating",
  "stale_blog",
  "irregular_blog",
  "stale_products",
  "out_of_stock",
  "missing_alt",
]);

type FindingsLead = {
  name: string;
  findings: LeadFindingCode[];
  findingDetails: Partial<Record<LeadFindingCode, string>>;
  language: LeadEmailLanguage;
};

export function LeadFindings({
  lead,
  max,
}: {
  lead: FindingsLead;
  max?: number;
}) {
  const { t } = useTranslation("leads");
  const [open, setOpen] = useState(false);
  if (lead.findings.length === 0) return null;

  const detailLabel = (code: LeadFindingCode) => {
    const value = lead.findingDetails[code];
    if (!value) return null;
    return DETAIL_FORMATS.has(code)
      ? t(`findingDetail.${code as "thin_content"}`, { value })
      : value;
  };

  const copy = async () => {
    await navigator.clipboard.writeText(
      findingBullets(lead.findings, lead.language, lead.findingDetails),
    );
    toast.success(t("findingsPanel.copied"));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("findingsPanel.open")}
        className="rounded-md text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <FindingChips findings={lead.findings} max={max} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {t("findingsPanel.title")} · {lead.name}
            </SheetTitle>
            <SheetDescription>
              {t("findingsPanel.description", { name: lead.name })}
            </SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-between px-4">
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("findingsPanel.count", { count: lead.findings.length })}
            </span>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              <Copy data-icon="inline-start" />
              {t("findingsPanel.copy")}
            </Button>
          </div>
          <div className="space-y-6 px-4 pb-6">
            {LEAD_FINDING_CATEGORIES.map((category) => {
              const codes = lead.findings.filter(
                (code) => LEAD_FINDING_META[code][0] === category,
              );
              if (codes.length === 0) return null;
              return (
                <section key={category} className="space-y-3">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t(`findingCategories.${category}`)}
                  </h3>
                  <ul className="space-y-3">
                    {codes.map((code) => {
                      const severity = LEAD_FINDING_META[code][1];
                      const detail = detailLabel(code);
                      return (
                        <li key={code} className="flex gap-2.5">
                          <span
                            title={t(`findingSeverity.${severity}`)}
                            className={cn(
                              "mt-1.5 size-2 shrink-0 rounded-full",
                              SEVERITY_DOT[severity],
                            )}
                          />
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-medium leading-snug">
                              {t(`findings.${code}`)}
                              {detail ? (
                                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                                  {detail}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {t(`findingWhy.${code}`)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
