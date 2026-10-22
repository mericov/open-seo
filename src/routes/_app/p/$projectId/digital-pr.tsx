import {
  createFileRoute,
  Link,
  Outlet,
  useParams,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/client/components/PageHeader";
import { cn } from "cn";

export const Route = createFileRoute("/_app/p/$projectId/digital-pr")({
  component: DigitalPrLayout,
});

const TABS = [
  { to: "/p/$projectId/digital-pr/gap", label: "tabs.gap" },
  { to: "/p/$projectId/digital-pr/media", label: "tabs.media" },
  { to: "/p/$projectId/digital-pr/outreach", label: "tabs.outreach" },
] as const;

function DigitalPrLayout() {
  const { t } = useTranslation("digitalPr");
  const { projectId } = useParams({ from: "/_app/p/$projectId/digital-pr" });
  return (
    <div className="overflow-auto bg-background px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <nav className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ projectId }}
              className={cn(
                "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
              )}
              activeProps={{ className: "border-foreground text-foreground" }}
            >
              {t(tab.label)}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
