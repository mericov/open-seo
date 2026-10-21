import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { leadsQueryKey } from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  generateLeadFirstLines,
  setLeadHidden,
  setLeadStatus,
} from "@/serverFunctions/leads";
import type { LeadOutreachStatus } from "@/shared/leadFindings";

export function useLeadActions(projectId: string, onDone: () => void) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: leadsQueryKey(projectId) });

  const status = useMutation({
    mutationFn: (input: { leadIds: string[]; status: LeadOutreachStatus }) =>
      setLeadStatus({ data: { projectId, ...input } }),
    onSuccess: async (result) => {
      toast.success(t("all.updated", { count: result.updated }));
      onDone();
      await refresh();
    },
  });

  const lines = useMutation({
    mutationFn: (leadIds: string[]) =>
      generateLeadFirstLines({ data: { projectId, leadIds } }),
    onSuccess: async (result) => {
      toast.success(t("firstLine.written", { count: result.written }));
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const hide = useMutation({
    mutationFn: (input: { leadIds: string[]; hidden: boolean }) =>
      setLeadHidden({ data: { projectId, ...input } }),
    onSuccess: async (result, input) => {
      onDone();
      await refresh();
      if (!input.hidden) return;
      toast.success(t("hide.done", { count: result.updated }), {
        action: {
          label: t("hide.undo"),
          onClick: () => hide.mutate({ leadIds: input.leadIds, hidden: false }),
        },
      });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return { status, lines, hide };
}
