import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ClipboardCopy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CopyButton } from "@/client/components/CopyButton";
import { Spinner } from "@/client/components/Spinner";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Textarea } from "@/client/components/ui/textarea";
import { useCopy } from "@/client/hooks/useCopy";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { getCurrentLanguage } from "@/i18n/config";
import { getPageRewritePrompt } from "@/serverFunctions/blogTracking";
import type { BlogTrackingDateRange } from "@/types/schemas/blog-tracking";

export function RewritePromptButton({
  projectId,
  id,
  dateRange,
}: {
  projectId: string;
  id: string;
  dateRange: BlogTrackingDateRange;
}) {
  const { t } = useTranslation("blogTracking");
  const { copy } = useCopy();
  const [prompt, setPrompt] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      getPageRewritePrompt({
        data: {
          projectId,
          id,
          dateRange,
          language: getCurrentLanguage() === "tr" ? "tr" : "en",
        },
      }),
    meta: { errorToast: false },
    onSuccess: (result) => {
      setPrompt(result.prompt);
      void copy(result.prompt, t("rewrite.copied"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <Spinner size="sm" />
        ) : (
          <ClipboardCopy data-icon="inline-start" />
        )}
        {t("rewrite.button")}
      </Button>
      {prompt !== null ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPrompt(null);
          }}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("rewrite.title")}</DialogTitle>
              <DialogDescription>{t("rewrite.description")}</DialogDescription>
            </DialogHeader>
            <Textarea
              readOnly
              value={prompt}
              className="h-96 font-mono text-xs"
              aria-label={t("rewrite.title")}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setPrompt(null)}>
                {t("rewrite.close")}
              </Button>
              <CopyButton
                value={prompt}
                successMessage={t("rewrite.copied")}
                variant="default"
                size="default"
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
