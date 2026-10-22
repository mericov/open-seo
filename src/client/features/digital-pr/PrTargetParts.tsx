import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronDown, Pencil, StickyNote } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { localToday } from "@/client/features/leads/LeadNote";
import {
  prQueryKey,
  type PrTarget,
} from "@/client/features/digital-pr/prQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { setPrTargetNote, setPrTargetPitch } from "@/serverFunctions/digitalPr";
import { PR_TARGET_STATUSES, type PrTargetStatus } from "@/shared/digitalPr";
import { cn } from "cn";
const STATUS_DOT: Record<PrTargetStatus, string> = {
  new: "bg-muted-foreground/40",
  drafted: "bg-warning",
  pitched: "bg-info",
  followup: "bg-info/60",
  replied: "bg-success",
  won: "bg-primary",
  declined: "bg-destructive/60",
};

function PrStatusLabel({ status }: { status: PrTargetStatus }) {
  const { t } = useTranslation("digitalPr");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {t(`statuses.${status}`)}
    </span>
  );
}

export function PrStatusMenu({
  status,
  onChange,
  disabled,
  trigger,
}: {
  status?: PrTargetStatus;
  onChange: (status: PrTargetStatus) => void;
  disabled?: boolean;
  trigger?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        {trigger ?? (status ? <PrStatusLabel status={status} /> : null)}
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {PR_TARGET_STATUSES.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onChange(option)}>
            <PrStatusLabel status={option} />
            {option === status ? <Check className="ml-auto size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PitchEditor({
  projectId,
  target,
}: {
  projectId: string;
  target: PrTarget;
}) {
  const { t } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (pitch: string) =>
      setPrTargetPitch({ data: { projectId, targetId: target.id, pitch } }),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (draft !== null) {
    return (
      <Textarea
        autoFocus
        rows={4}
        value={draft}
        disabled={mutation.isPending}
        aria-label={t("outreach.editPitch")}
        className="mt-2 text-xs"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() =>
          draft.trim() === (target.pitch ?? "")
            ? setDraft(null)
            : mutation.mutate(draft)
        }
        onKeyDown={(event) => {
          if (event.key === "Escape") setDraft(null);
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            mutation.mutate(draft);
          }
        }}
      />
    );
  }
  if (!target.pitch) {
    return (
      <button
        type="button"
        onClick={() => setDraft("")}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        <Pencil className="size-3" />
        {t("outreach.addPitch")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setDraft(target.pitch ?? "")}
      title={t("outreach.editPitch")}
      className="group/line mt-2 flex w-full max-w-md items-start gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-left text-xs leading-relaxed text-foreground/80 hover:bg-muted"
    >
      <span className="flex-1 whitespace-normal">{target.pitch}</span>
      <Pencil className="mt-0.5 size-3 shrink-0 opacity-0 group-hover/line:opacity-60" />
    </button>
  );
}

export function TargetNote({
  projectId,
  target,
}: {
  projectId: string;
  target: PrTarget;
}) {
  const { t, i18n } = useTranslation("digitalPr");
  const [open, setOpen] = useState(false);
  const hasNote = Boolean(target.noteText || target.remindAt);
  const due = target.remindAt != null && target.remindAt <= localToday();

  return (
    <>
      {hasNote ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 flex w-full max-w-md items-start gap-2 rounded-lg px-1 py-0.5 text-left text-xs hover:bg-muted/60"
        >
          <span className="min-w-0 flex-1">
            {target.noteText ? (
              <span
                className="line-clamp-2 text-foreground/80"
                title={target.noteText}
              >
                {target.noteText}
              </span>
            ) : null}
            {target.remindAt ? (
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1",
                  due
                    ? "font-medium text-destructive"
                    : "text-muted-foreground",
                )}
              >
                <Bell className="size-3" />
                {new Date(`${target.remindAt}T12:00:00`).toLocaleDateString(
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
          className="mt-1.5 ml-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
        >
          <StickyNote className="size-3" />
          {t("outreach.addNote")}
        </button>
      )}
      {open ? (
        <NoteDialog
          projectId={projectId}
          target={target}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function NoteDialog({
  projectId,
  target,
  onClose,
}: {
  projectId: string;
  target: PrTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const [text, setText] = useState(target.noteText ?? "");
  const [remindAt, setRemindAt] = useState(target.remindAt ?? "");
  const mutation = useMutation({
    mutationFn: (input: { noteText: string; remindAt: string | null }) =>
      setPrTargetNote({ data: { projectId, targetId: target.id, ...input } }),
    onSuccess: async () => {
      onClose();
      await queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("outreach.noteTitle", {
              name:
                target.contactName ?? target.outletName ?? target.outletDomain,
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            autoFocus
            rows={4}
            placeholder={t("outreach.notePlaceholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Field>
            <FieldLabel htmlFor="pr-note-remind">
              {t("outreach.remind")}
            </FieldLabel>
            <Input
              id="pr-note-remind"
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
            onClick={() => mutation.mutate({ noteText: "", remindAt: null })}
          >
            {t("outreach.clearNote")}
          </Button>
          <Button
            pending={mutation.isPending}
            onClick={() =>
              mutation.mutate({ noteText: text, remindAt: remindAt || null })
            }
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
