import { useTranslation } from "react-i18next";
import { PageHeader } from "@/client/components/PageHeader";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import {
  MetaConnectionCard,
  MetaSetupGuide,
} from "@/client/features/social/MetaConnectionCard";
import { SocialContextPanel } from "@/client/features/social/SocialContextPanel";
import { SocialMediaLibrary } from "@/client/features/social/SocialMediaLibrary";

export const SOCIAL_TABS = ["setup", "context", "media"] as const;
type SocialTab = (typeof SOCIAL_TABS)[number];

export function SocialStudioPage({
  projectId,
  tab,
  onTabChange,
}: {
  projectId: string;
  tab: SocialTab;
  onTabChange: (tab: SocialTab) => void;
}) {
  const { t } = useTranslation("social");
  return (
    <div className="h-full overflow-auto bg-background px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <SegmentedToggle
          showLabels
          value={tab}
          onChange={onTabChange}
          items={SOCIAL_TABS.map((value) => ({
            value,
            icon: null,
            label: t(`tabs.${value}`),
          }))}
        />
        {tab === "setup" ? (
          <div className="space-y-4">
            <MetaConnectionCard projectId={projectId} />
            <MetaSetupGuide />
          </div>
        ) : tab === "context" ? (
          <SocialContextPanel projectId={projectId} />
        ) : (
          <SocialMediaLibrary projectId={projectId} />
        )}
      </div>
    </div>
  );
}
