import { beforeEach, expect, it, vi } from "vitest";
import { LeadFirstLineService } from "@/server/features/leads/services/LeadFirstLineService";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  listForFirstLines: vi.fn(),
  listFindings: vi.fn(),
  setFirstLine: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: { object: (input: unknown) => input },
}));
vi.mock("@/server/lib/openrouter", () => ({ buildChatAgentModel: () => ({}) }));
vi.mock("@/server/lib/chatAgent", () => ({
  requireOpenRouterCostUsd: () => 0,
}));
vi.mock("@/server/billing/researchSpend", () => ({
  billResearchSpend: vi.fn(),
}));
vi.mock("@/server/billing/subscription", () => ({
  checkUsageCreditsDepleted: vi.fn(),
}));
vi.mock("@/server/lib/runtime-env", () => ({
  getRequiredEnvValue: async () => "key",
  getOptionalEnvValue: async () => undefined,
  isHostedServerAuthMode: async () => false,
}));
vi.mock("@/server/features/leads/repositories/LeadListRepository", () => ({
  LeadListRepository: {
    listForFirstLines: mocks.listForFirstLines,
    listFindings: mocks.listFindings,
    setFirstLine: mocks.setFirstLine,
  },
}));

beforeEach(() => {
  mocks.listForFirstLines.mockResolvedValue([
    {
      id: "tr-lead",
      name: "Kadıköy Diş",
      category: "dentist",
      domain: null,
      website: null,
      countryCode: null,
      productCount: null,
      rating: 4.8,
      reviewsCount: 6,
      source: "local",
      locationLabel: "Kadıköy, Istanbul, Turkey",
    },
    {
      id: "us-store",
      name: "Candle Co",
      category: null,
      domain: "candle.test",
      website: "https://candle.test/",
      countryCode: "US",
      productCount: 40,
      rating: null,
      reviewsCount: null,
      source: "shopify",
      locationLabel: "",
    },
  ]);
  mocks.listFindings.mockResolvedValue([
    { leadId: "tr-lead", code: "no_website" },
    { leadId: "us-store", code: "no_schema" },
  ]);
  mocks.generateText.mockResolvedValue({
    output: {
      lines: [
        { id: "tr-lead", line: "Google'da web siteniz görünmüyor." },
        { id: "us-store", line: "I couldn't see product details for Google." },
        { id: "someone-else", line: "Should be ignored." },
      ],
    },
  });
});

it("writes first lines in each lead's language from its gaps and ignores ids it did not ask about", async () => {
  const result = await LeadFirstLineService.generate(
    "p1",
    ["tr-lead", "us-store"],
    { organizationId: "org" } as never,
  );

  const sent = JSON.parse(mocks.generateText.mock.calls[0][0].prompt);
  expect(sent).toEqual([
    expect.objectContaining({
      id: "tr-lead",
      language: "tr",
      facts: [expect.stringContaining("don't have a website")],
    }),
    expect.objectContaining({
      id: "us-store",
      language: "en",
      kind: "online store",
    }),
  ]);
  expect(result).toEqual({ written: 2 });
  expect(mocks.setFirstLine).not.toHaveBeenCalledWith(
    "p1",
    "someone-else",
    expect.anything(),
  );
});
