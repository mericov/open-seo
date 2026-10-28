import { describe, expect, it } from "vitest";
import { keywordOpportunity } from "@/shared/keywordOpportunity";

describe("keywordOpportunity", () => {
  it("ranks an easy, searched, commercial keyword above a hard, rare one", () => {
    const easy = keywordOpportunity({
      searchVolume: 5000,
      keywordDifficulty: 15,
      cpc: 2,
      intent: "commercial",
    });
    const hard = keywordOpportunity({
      searchVolume: 30,
      keywordDifficulty: 85,
      cpc: 0.1,
      intent: "navigational",
    });
    expect(easy).toBeGreaterThan(hard);
  });

  it("stays within 0-100 when metrics are missing", () => {
    const score = keywordOpportunity({
      searchVolume: null,
      keywordDifficulty: null,
      cpc: null,
      intent: "unknown",
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
