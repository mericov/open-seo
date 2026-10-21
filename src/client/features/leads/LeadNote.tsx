import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import {
  leadsQueryKey,
  type ProjectLeadRow,
} from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { setLeadNote } from "@/serverFunctions/leads";
import { LEAD_NOTE_COLORS, type LeadNoteColor } from "@/shared/leadFindings";
import { cn } from "cn";

const NOTE_DOT: Record<LeadNoteColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  gray: "bg-gray-400",
};

export function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function LeadNote({
  projectId,
  lead,
}: {
  projectId: string;
  lead: ProjectLeadRow;
}) {
  const { t, i18n } = useTranslation("leads");
  const [open, setOpen] = useState(false);
  const hasNote = Boolean(lead.noteColor || lead.noteText || lead.remindAt);
  const due = lead.remindAt != null && lead.remindAt <= localToday();

  return (
    <>
      {hasNote ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 flex w-full max-w-md items-start gap-2 rounded-lg px-1 py-0.5 text-left text-xs hover:bg-muted/60"
        >
          {lead.noteColor ? (
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full",
                NOTE_DOT[lead.noteColor],
              )}
            />
          ) : null}
          <span className="min-w-0 flex-1">
            {lead.noteText ? (
              <span
                className="line-clamp-2 text-foreground/80"
                title={lead.noteText}
              >
                {lead.noteText}
              </span>
            ) : null}
            {lead.remindAt ? (
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1",
                  due
                    ? "font-medium text-destructive"
                    : "text-muted-foreground",
                )}
              >
                <Bell className="size-3" />
                {new Date(`${lead.remindAt}T12:00:00`).toLocaleDateString(
                  i18n.language,
                  { day: "numeric", month: "short" },
                )}
              </span>
            ) : null}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
        >
          <StickyNote className="size-3" />
          {t("notes.add")}
        </button>
      )}
      {open ? (
        <NoteDialog
          projectId={projectId}
          lead={lead}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function NoteDialog({
  projectId,
  lead,
  onClose,
}: {
  projectId: string;
  lead: ProjectLeadRow;
  onClose: () => void;
}) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const [color, setColor] = useState<LeadNoteColor | null>(lead.noteColor);
  const [text, setText] = useState(lead.noteText ?? "");
  const [remindAt, setRemindAt] = useState(lead.remindAt ?? "");

  const mutation = useMutation({
    mutationFn: (input: {
      color: LeadNoteColor | null;
      text: string;
      remindAt: string | null;
    }) => setLeadNote({ data: { projectId, leadId: lead.id, ...input } }),
    onSuccess: async () => {
      onClose();
      await queryClient.invalidateQueries({
        queryKey: leadsQueryKey(projectId),
      });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("notes.title", { name: lead.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {LEAD_NOTE_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={t(`notes.colors.${option}`)}
                aria-pressed={color === option}
                onClick={() => setColor(color === option ? null : option)}
                className={cn(
                  "size-6 rounded-full ring-offset-2 ring-offset-background transition",
                  NOTE_DOT[option],
                  color === option ? "ring-2 ring-foreground" : "opacity-70",
                )}
              />
            ))}
          </div>
          <Textarea
            autoFocus
            rows={4}
            placeholder={t("notes.placeholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Field>
            <FieldLabel htmlFor="note-remind">{t("notes.remind")}</FieldLabel>
            <Input
              id="note-remind"
              type="date"
              value={remindAt}
              onChange={(event) => setRemindAt(event.target.value)}
              className="w-44"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() =>
              mutation.mutate({ color: null, text: "", remindAt: null })
            }
          >
            {t("notes.clear")}
          </Button>
          <Button
            pending={mutation.isPending}
            onClick={() =>
              mutation.mutate({ color, text, remindAt: remindAt || null })
            }
          >
            {t("notes.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
