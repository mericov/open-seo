import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { prQueryKey } from "@/client/features/digital-pr/prQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  addMediaToList,
  rescanMediaOutlets,
  setMediaContactHidden,
  setMediaOutletsHidden,
} from "@/serverFunctions/digitalPr";

export function useMediaActions(projectId: string, onDone: () => void) {
  const { t } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });

  const addMutation = useMutation({
    mutationFn: (input: { outletIds: string[]; contactIds: string[] }) =>
      addMediaToList({ data: { projectId, ...input } }),
    onSuccess: async (result) => {
      toast.success(
        t("common.addedToList", {
          count: result.added,
          skipped: result.skipped,
        }),
      );
      onDone();
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const hideMutation = useMutation({
    mutationFn: (input: { outletIds: string[]; hidden: boolean }) =>
      setMediaOutletsHidden({ data: { projectId, ...input } }),
    onSuccess: async (result, input) => {
      onDone();
      await refresh();
      if (!input.hidden) return;
      toast.success(t("common.hidden", { count: result.updated }), {
        action: {
          label: t("common.undo"),
          onClick: () =>
            hideMutation.mutate({ outletIds: input.outletIds, hidden: false }),
        },
      });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const rescanMutation = useMutation({
    mutationFn: (outletIds: string[]) =>
      rescanMediaOutlets({ data: { projectId, outletIds } }),
    onSuccess: async (result) => {
      toast.success(t("media.rescanQueued", { count: result.queued }));
      onDone();
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const hideContactMutation = useMutation({
    mutationFn: (contactId: string) =>
      setMediaContactHidden({ data: { projectId, contactId, hidden: true } }),
    onSuccess: refresh,
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return { addMutation, hideMutation, rescanMutation, hideContactMutation };
}
