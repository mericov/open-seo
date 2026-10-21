import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/client/components/ui/textarea";
import { leadsQueryKey } from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { updateLeadFirstLine } from "@/serverFunctions/leads";

export function FirstLineEditor({
  projectId,
  leadId,
  firstLine,
}: {
  projectId: string;
  leadId: string;
  firstLine: string | null;
}) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (text: string) =>
      updateLeadFirstLine({ data: { projectId, leadId, firstLine: text } }),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({
        queryKey: leadsQueryKey(projectId),
      });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (draft !== null) {
    return (
      <Textarea
        autoFocus
        rows={3}
        value={draft}
        disabled={mutation.isPending}
        aria-label={t("firstLine.edit")}
        className="mt-2 text-xs"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() =>
          draft.trim() === (firstLine ?? "")
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
  if (!firstLine) return null;
  return (
    <button
      type="button"
      onClick={() => setDraft(firstLine)}
      title={t("firstLine.edit")}
      className="group/line mt-2 flex w-full max-w-md items-start gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-left text-xs leading-relaxed text-foreground/80 hover:bg-muted"
    >
      <span className="flex-1 whitespace-normal">{firstLine}</span>
      <Pencil className="mt-0.5 size-3 shrink-0 opacity-0 group-hover/line:opacity-60" />
    </button>
  );
}
