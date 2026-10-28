import { useState } from "react";
import { reverse } from "remeda";
import { Trash2 } from "lucide-react";
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
import { Textarea } from "@/client/components/ui/textarea";
import { FilterSelect } from "@/client/features/leads/AllLeadsControls";
import type { TrafficHistoryData } from "./trafficHistoryQueries";
import { formatMonth } from "./trafficHistoryUtils";

type Props = {
  months: string[];
  notes: TrafficHistoryData["notes"];
  saving: boolean;
  onSave: (month: string, body: string) => void;
  onDelete: (noteId: string) => void;
  onClose: () => void;
};

export function TrafficNotesDialog({
  months,
  notes,
  saving,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { t } = useTranslation("trafficHistory");
  const options = reverse(months);
  const [month, setMonth] = useState(options[0] ?? "");
  const [body, setBody] = useState("");

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("notes.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field>
            <FieldLabel>{t("notes.month")}</FieldLabel>
            <FilterSelect
              value={month}
              options={options}
              label={(value) => formatMonth(value, "long")}
              onChange={setMonth}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="traffic-note-body">
              {t("notes.body")}
            </FieldLabel>
            <Textarea
              id="traffic-note-body"
              value={body}
              maxLength={500}
              placeholder={t("notes.placeholder")}
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            pending={saving}
            disabled={!month || body.trim() === ""}
            onClick={() => {
              onSave(month, body.trim());
              setBody("");
            }}
          >
            {t("notes.save")}
          </Button>
        </DialogFooter>
        <div className="border-t border-border pt-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("notes.empty")}</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {notes.map((note) => (
                <li key={note.id} className="flex items-start gap-2 text-sm">
                  <span className="w-24 shrink-0 font-medium">
                    {formatMonth(note.month)}
                  </span>
                  <span className="flex-1 break-words">{note.body}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("notes.delete")}
                    onClick={() => onDelete(note.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
