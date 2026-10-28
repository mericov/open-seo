import type { BillingCustomerContext } from "@/server/billing/subscription";
import { meter } from "@/server/lib/dataforseo/client";
import { dataforseoPricing } from "@/server/lib/dataforseo/pricing";
import {
  fetchDomainRankByLocation,
  fetchHistoricalRankOverview,
} from "@/server/lib/dataforseo/traffic-history";

export function createTrafficHistoryClient(customer: BillingCustomerContext) {
  return {
    historicalRankOverview: meter(
      customer,
      fetchHistoricalRankOverview,
      dataforseoPricing.domain.historicalRankOverview,
      "domain_overview",
    ),
    rankByLocation: meter(
      customer,
      fetchDomainRankByLocation,
      dataforseoPricing.domain.rankByLocation,
      "domain_overview",
    ),
  };
}
