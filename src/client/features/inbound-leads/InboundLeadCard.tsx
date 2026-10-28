import { useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { Textarea } from "@/client/components/ui/textarea";
import type { listInboundLeads } from "@/serverFunctions/inboundLeads";
import {
  INBOUND_LEAD_STATUSES,
  type InboundLeadStatus,
  type InboundLeadVerdict,
} from "@/shared/inboundLeads";

type InboundLead = Awaited<
  ReturnType<typeof listInboundLeads>
>["leads"][number];

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("0") ? `90${digits.slice(1)}` : digits;
  return `https://wa.me/${full}`;
}

function formatDate(value: string, locale: string) {
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export function InboundLeadCard({
  lead,
  locale,
  busy,
  onStatus,
  onVerdict,
  onNote,
  onRemove,
}: {
  lead: InboundLead;
  locale: string;
  busy: boolean;
  onStatus: (status: InboundLeadStatus) => void;
  onVerdict: (verdict: InboundLeadVerdict) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("inboundLeads");
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(lead.note ?? "");
  const site = lead.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {lead.name || lead.email || lead.phone || t("unnamed")}
            </span>
            {lead.verdict !== "ok" ? (
              <Badge
                variant={lead.verdict === "spam" ? "destructive" : "secondary"}
              >
                {t(`verdict.${lead.verdict}`)}
              </Badge>
            ) : null}
            {lead.locale ? (
              <Badge variant="outline">{lead.locale.toUpperCase()}</Badge>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(lead.createdAt, locale)}
            {lead.source ? ` · ${lead.source}` : ""}
            {lead.page ? ` · ${lead.page}` : ""}
            {lead.secondsOnPage != null
              ? ` · ${t("seconds", { count: lead.secondsOnPage })}`
              : ""}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm hover:bg-muted"
          >
            {t(`status.${lead.status}`)}
            <ChevronDown className="size-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {INBOUND_LEAD_STATUSES.map((option) => (
              <DropdownMenuItem key={option} onClick={() => onStatus(option)}>
                {t(`status.${option}`)}
                {option === lead.status ? (
                  <Check className="ml-auto size-3.5" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {lead.email ? (
          <a
            className="inline-flex items-center gap-1.5 hover:underline"
            href={`mailto:${lead.email}`}
          >
            <Mail className="size-3.5 text-muted-foreground" />
            {lead.email}
          </a>
        ) : null}
        {lead.phone ? (
          <>
            <a
              className="inline-flex items-center gap-1.5 hover:underline"
              href={`tel:${lead.phone}`}
            >
              <Phone className="size-3.5 text-muted-foreground" />
              {lead.phone}
            </a>
            <a
              className="inline-flex items-center gap-1.5 hover:underline"
              href={whatsappLink(lead.phone)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-3.5 text-muted-foreground" />
              WhatsApp
            </a>
          </>
        ) : null}
        {lead.website ? (
          <a
            className="inline-flex items-center gap-1.5 hover:underline"
            href={lead.website}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            {site}
          </a>
        ) : null}
      </div>

      {lead.message ? (
        <p className="mt-3 whitespace-pre-wrap text-sm">{lead.message}</p>
      ) : null}
      {lead.reason ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("reason")}: {lead.reason}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t("notePlaceholder")}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                onNote(note);
                setEditing(false);
              }}
            >
              {t("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : lead.note ? (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {lead.note}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <StickyNote className="size-3.5" />
          {lead.note ? t("editNote") : t("addNote")}
        </Button>
        {lead.verdict === "spam" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onVerdict("ok")}
          >
            <ShieldCheck className="size-3.5" />
            {t("notSpam")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onVerdict("spam")}
          >
            <ShieldAlert className="size-3.5" />
            {t("markSpam")}
          </Button>
        )}
        {lead.verdict === "suspicious" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onVerdict("ok")}
          >
            <ShieldCheck className="size-3.5" />
            {t("markReal")}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("confirmDelete"))) onRemove();
          }}
        >
          <Trash2 className="size-3.5" />
          {t("delete")}
        </Button>
      </div>
    </li>
  );
}
