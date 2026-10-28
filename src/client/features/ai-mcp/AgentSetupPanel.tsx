import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CopyButton } from "@/client/components/CopyButton";

export function AgentSetupPanel({
  prompt,
  onCopy,
}: {
  prompt: string;
  onCopy?: () => void;
}) {
  const { t } = useTranslation("onboarding");
  return (
    <>
      <div className="rounded-xl border border-border bg-background/25 p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
            <Package className="size-5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">{t("agent.pluginName")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("agent.pluginDetail")}
            </p>
          </div>
        </div>
        <CopyButton
          variant="default"
          size="lg"
          className="w-full"
          value={prompt}
          label={t("agent.copyPrompt")}
          successMessage={t("agent.promptCopied")}
          onCopy={onCopy}
        />
      </div>
      <div className="mt-4 text-center">
        <a
          href="https://openseo.so/docs/agent-setup"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline decoration-muted-foreground/25 underline-offset-4 hover:text-foreground"
        >
          {t("agent.manualSetup")}
        </a>
      </div>
    </>
  );
}
