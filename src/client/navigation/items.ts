import {
  Bookmark,
  Bot,
  Brain,
  ChartLine,
  ClipboardCheck,
  FileText,
  GitCompareArrows,
  Globe,
  Inbox,
  LayoutDashboard,
  Library,
  Link2,
  MessageSquare,
  Newspaper,
  PenLine,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { linkOptions } from "@tanstack/react-router";
import { GoogleGlyphMuted } from "@/client/features/gsc/GoogleGlyph";

const projectNavItems = [
  {
    to: "/p/$projectId" as const,
    label: "nav:items.dashboard" as const,
    icon: LayoutDashboard,
    // Without exact matching, the index path is a prefix of every project
    // route and the Dashboard item would render active everywhere.
    activeOptions: { exact: true, includeSearch: false },
  },
  {
    to: "/p/$projectId/keywords" as const,
    label: "nav:items.keywordResearch" as const,
    icon: Search,
  },
  {
    to: "/p/$projectId/saved" as const,
    label: "nav:items.savedKeywords" as const,
    icon: Bookmark,
  },
  {
    to: "/p/$projectId/rank-tracking" as const,
    label: "nav:items.rankTracking" as const,
    icon: TrendingUp,
  },
  {
    to: "/p/$projectId/search-performance" as const,
    label: "nav:items.gscInsights" as const,
    icon: GoogleGlyphMuted,
  },
  {
    to: "/p/$projectId/blog-tracking" as const,
    label: "nav:items.blogTracking" as const,
    icon: Newspaper,
  },
  {
    to: "/p/$projectId/blog-writer" as const,
    label: "nav:items.blogWriter" as const,
    icon: PenLine,
  },
  {
    to: "/p/$projectId/shopify" as const,
    label: "nav:items.shopify" as const,
    icon: ShoppingBag,
  },
  {
    to: "/p/$projectId/inbound-leads" as const,
    label: "nav:items.inboundLeads" as const,
    icon: Inbox,
  },
  {
    to: "/p/$projectId/leads" as const,
    label: "nav:items.leadFinder" as const,
    icon: Users,
  },
  {
    to: "/p/$projectId/digital-pr/gap" as const,
    label: "nav:items.prGap" as const,
    icon: GitCompareArrows,
  },
  {
    to: "/p/$projectId/digital-pr/media" as const,
    label: "nav:items.prMedia" as const,
    icon: Library,
  },
  {
    to: "/p/$projectId/digital-pr/outreach" as const,
    label: "nav:items.prOutreach" as const,
    icon: Send,
  },
  {
    to: "/p/$projectId/domain" as const,
    label: "nav:items.domainOverview" as const,
    icon: Globe,
  },
  {
    to: "/p/$projectId/backlinks" as const,
    label: "nav:items.backlinks" as const,
    icon: Link2,
  },
  {
    to: "/p/$projectId/audit" as const,
    label: "nav:items.siteAudit" as const,
    icon: ClipboardCheck,
  },
  {
    to: "/p/$projectId/ai-visibility" as const,
    label: "nav:items.promptTracking" as const,
    icon: ChartLine,
    activeOptions: { exact: true, includeSearch: false },
  },
  {
    to: "/p/$projectId/ai-visibility/research" as const,
    label: "nav:items.promptResearch" as const,
    icon: Search,
  },
  {
    to: "/p/$projectId/prompt-explorer" as const,
    label: "nav:items.promptExplorer" as const,
    icon: MessageSquare,
  },
  {
    to: "/p/$projectId/reports" as const,
    label: "nav:items.reports" as const,
    icon: FileText,
  },
  {
    to: "/p/$projectId/context" as const,
    label: "nav:items.context" as const,
    icon: Brain,
  },
] as const;

// Project-independent. Rendered inside the project "AI Tools" group when a project
// is selected, and on its own (connectNavGroup) when none is.
const aiNavItem = linkOptions({
  to: "/ai" as const,
  label: "nav:items.agentSetup" as const,
  icon: Bot,
});

// Shown only when no project is selected; with a project, Agent setup lives in
// the "AI Tools" group below.
export const connectNavGroup = {
  label: "nav:groups.aiTools" as const,
  items: [aiNavItem],
};

function getProjectNavItems(projectId: string) {
  return linkOptions(
    projectNavItems.map((item) => ({
      ...item,
      params: { projectId },
      search: {},
    })),
  );
}

// Grouped by scope: "My Site" is the project's own domain (tracked data),
// "Research" is point-at-anything lookup tools.
export function getProjectNavGroups(projectId: string) {
  const all = getProjectNavItems(projectId);
  const byPath = (path: (typeof projectNavItems)[number]["to"]) =>
    all.find((i) => i.to === path)!;

  return [
    {
      label: "nav:groups.overview" as const,
      items: [byPath("/p/$projectId")],
    },
    {
      label: "nav:groups.research" as const,
      items: [
        byPath("/p/$projectId/keywords"),
        byPath("/p/$projectId/domain"),
        byPath("/p/$projectId/backlinks"),
        byPath("/p/$projectId/leads"),
      ],
    },
    {
      label: "nav:groups.digitalPr" as const,
      items: [
        byPath("/p/$projectId/digital-pr/gap"),
        byPath("/p/$projectId/digital-pr/media"),
        byPath("/p/$projectId/digital-pr/outreach"),
      ],
    },
    {
      label: "nav:groups.mySite" as const,
      items: [
        byPath("/p/$projectId/inbound-leads"),
        byPath("/p/$projectId/search-performance"),
        byPath("/p/$projectId/rank-tracking"),
        byPath("/p/$projectId/blog-tracking"),
        byPath("/p/$projectId/blog-writer"),
        byPath("/p/$projectId/shopify"),
        byPath("/p/$projectId/saved"),
        byPath("/p/$projectId/audit"),
      ],
    },
    {
      label: "nav:groups.aiTools" as const,
      items: [
        byPath("/p/$projectId/reports"),
        byPath("/p/$projectId/context"),
        aiNavItem,
      ],
      folder: {
        label: "nav:groups.aiVisibility" as const,
        icon: Sparkles,
        items: [
          byPath("/p/$projectId/ai-visibility/research"),
          byPath("/p/$projectId/prompt-explorer"),
          byPath("/p/$projectId/ai-visibility"),
        ],
      },
    },
  ];
}

export const dataforseoHelpLinkOptions = linkOptions({
  to: "/help/dataforseo-api-key",
});
