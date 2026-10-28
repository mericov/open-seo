import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SkeletonPageContent } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/client/components/ui/tabs";
import { ShopifySeoTab } from "@/client/features/shopify/ShopifySeoTab";
import { ShopifyThemesTab } from "@/client/features/shopify/ShopifyThemesTab";
import { shopifyConnectionOptions } from "@/client/features/shopify/shopifyQueries";

type ShopifyTab = "seo" | "themes";

export function ShopifyPage({
  projectId,
  tab,
  onTabChange,
}: {
  projectId: string;
  tab: ShopifyTab;
  onTabChange: (tab: ShopifyTab) => void;
}) {
  const { t } = useTranslation("shopify");
  const connectionQuery = useQuery(shopifyConnectionOptions(projectId));
  const connection = connectionQuery.data;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title={
            connection?.connected && connection.shopName
              ? `${t("title")} · ${connection.shopName}`
              : t("title")
          }
          description={t("description")}
        />
        {!connection ? (
          <SkeletonPageContent />
        ) : !connection.connected ? (
          <EmptyState
            variant="card"
            icon={ShoppingBag}
            title={t("notConnected.title")}
            description={t("notConnected.description")}
            action={
              <Button
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/settings/integrations"
                    params={{ projectId }}
                    hash="shopify"
                  />
                }
              >
                {t("notConnected.action")}
              </Button>
            }
          />
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value: unknown) => {
              if (value === "seo" || value === "themes") onTabChange(value);
            }}
            className="gap-4"
          >
            <TabsList className="h-9">
              <TabsTrigger value="seo" className="px-3">
                {t("tabs.seo")}
              </TabsTrigger>
              <TabsTrigger value="themes" className="px-3">
                {t("tabs.themes")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="seo" keepMounted={false}>
              <ShopifySeoTab
                projectId={projectId}
                canManage={connection.canManage}
              />
            </TabsContent>
            <TabsContent value="themes" keepMounted={false}>
              <ShopifyThemesTab
                projectId={projectId}
                canManage={connection.canManage}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
