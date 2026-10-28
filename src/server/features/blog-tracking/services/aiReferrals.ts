import { sort } from "remeda";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { createGa4DataClient } from "@/server/lib/ga4Client";

const AI_SOURCE_PATTERN =
  "chatgpt|openai|perplexity|gemini|bard|copilot|claude|anthropic|deepseek|grok|phind";
const ROW_LIMIT = "5000";

const SOURCE_LABELS: [RegExp, string][] = [
  [/chatgpt|openai/i, "ChatGPT"],
  [/perplexity/i, "Perplexity"],
  [/gemini|bard/i, "Gemini"],
  [/copilot/i, "Copilot"],
  [/claude|anthropic/i, "Claude"],
  [/deepseek/i, "DeepSeek"],
  [/grok/i, "Grok"],
];

type AiReferral = {
  sessions: number;
  sources: { source: string; sessions: number }[];
};

export function pathKey(urlOrPath: string) {
  let path = urlOrPath;
  try {
    path = new URL(urlOrPath, "https://placeholder.invalid").pathname;
  } catch {
    path = urlOrPath.split("?")[0] ?? urlOrPath;
  }
  try {
    path = decodeURI(path);
  } catch {
    path = path.trim();
  }
  return path.replace(/\/+$/, "").toLowerCase() || "/";
}

function sourceLabel(source: string) {
  return SOURCE_LABELS.find(([pattern]) => pattern.test(source))?.[1] ?? source;
}

export async function fetchAiReferrals(
  projectId: string,
  range: { startDate: string; endDate: string },
): Promise<Map<string, AiReferral> | null> {
  const connection = await Ga4ConnectionRepository.getByProjectId(projectId);
  if (!connection) return null;
  try {
    const client = createGa4DataClient({
      userId: connection.connectedByUserId,
      ga4AccountId: connection.ga4AccountId,
      propertyId: connection.propertyId,
    });
    const response = await client.runReport({
      dateRanges: [range],
      dimensions: [{ name: "landingPage" }, { name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: {
        filter: {
          fieldName: "sessionSource",
          stringFilter: {
            matchType: "PARTIAL_REGEXP",
            value: AI_SOURCE_PATTERN,
            caseSensitive: false,
          },
        },
      },
      offset: "0",
      limit: ROW_LIMIT,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      keepEmptyRows: false,
      returnPropertyQuota: true,
    });
    const byPath = new Map<string, Map<string, number>>();
    for (const row of response.rows ?? []) {
      const landingPage = row.dimensionValues?.[0]?.value;
      const source = row.dimensionValues?.[1]?.value;
      const sessions = Number(row.metricValues?.[0]?.value ?? 0);
      if (!landingPage || !source || !sessions) continue;
      const key = pathKey(landingPage);
      const sources = byPath.get(key) ?? new Map<string, number>();
      const label = sourceLabel(source);
      sources.set(label, (sources.get(label) ?? 0) + sessions);
      byPath.set(key, sources);
    }
    const result = new Map<string, AiReferral>();
    for (const [key, sources] of byPath) {
      const list = sort(
        [...sources.entries()].map(([source, sessions]) => ({
          source,
          sessions,
        })),
        (a, b) => b.sessions - a.sessions,
      );
      result.set(key, {
        sessions: list.reduce((sum, item) => sum + item.sessions, 0),
        sources: list,
      });
    }
    return result;
  } catch (error) {
    console.warn("[page-tracking] GA4 AI referrals unavailable", error);
    return null;
  }
}
