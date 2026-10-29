import enAuth from "./en/auth.json";
import enBlogTracking from "./en/blogTracking.json";
import enBlogWriter from "./en/blogWriter.json";
import enCommon from "./en/common.json";
import enErrors from "./en/errors.json";
import enNav from "./en/nav.json";
import enSettings from "./en/settings.json";
import enOnboarding from "./en/onboarding.json";
import enIntegrations from "./en/integrations.json";
import enLeads from "./en/leads.json";
import enDigitalPr from "./en/digitalPr.json";
import enInboundLeads from "./en/inboundLeads.json";
import enTrafficHistory from "./en/trafficHistory.json";
import enShopify from "./en/shopify.json";
import enSocial from "./en/social.json";
import enAds from "./en/ads.json";
import trAuth from "./tr/auth.json";
import trBlogTracking from "./tr/blogTracking.json";
import trBlogWriter from "./tr/blogWriter.json";
import trCommon from "./tr/common.json";
import trErrors from "./tr/errors.json";
import trNav from "./tr/nav.json";
import trSettings from "./tr/settings.json";
import trOnboarding from "./tr/onboarding.json";
import trIntegrations from "./tr/integrations.json";
import trLeads from "./tr/leads.json";
import trDigitalPr from "./tr/digitalPr.json";
import trInboundLeads from "./tr/inboundLeads.json";
import trTrafficHistory from "./tr/trafficHistory.json";
import trShopify from "./tr/shopify.json";
import trSocial from "./tr/social.json";
import trAds from "./tr/ads.json";

export const resources = {
  en: {
    auth: enAuth,
    blogTracking: enBlogTracking,
    blogWriter: enBlogWriter,
    common: enCommon,
    errors: enErrors,
    nav: enNav,
    settings: enSettings,
    onboarding: enOnboarding,
    integrations: enIntegrations,
    leads: enLeads,
    digitalPr: enDigitalPr,
    inboundLeads: enInboundLeads,
    trafficHistory: enTrafficHistory,
    shopify: enShopify,
    social: enSocial,
    ads: enAds,
  },
  tr: {
    auth: trAuth,
    blogTracking: trBlogTracking,
    blogWriter: trBlogWriter,
    common: trCommon,
    errors: trErrors,
    nav: trNav,
    settings: trSettings,
    onboarding: trOnboarding,
    integrations: trIntegrations,
    leads: trLeads,
    digitalPr: trDigitalPr,
    inboundLeads: trInboundLeads,
    trafficHistory: trTrafficHistory,
    shopify: trShopify,
    social: trSocial,
    ads: trAds,
  },
} as const;

export const defaultNamespace = "common";
