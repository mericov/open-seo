import type { KeywordIntent } from "@/types/keywords";

const INTENT_BONUS: Record<KeywordIntent, number> = {
  transactional: 1,
  commercial: 1,
  informational: 0.5,
  navigational: 0,
  unknown: 0.5,
};

export function keywordOpportunity(row: {
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  intent: KeywordIntent;
}): number {
  const volume =
    row.searchVolume === null
      ? 0.3
      : Math.min(1, Math.log10(row.searchVolume + 1) / 5);
  const ease =
    row.keywordDifficulty === null ? 0.5 : 1 - row.keywordDifficulty / 100;
  const value = row.cpc === null ? 0.3 : Math.min(1, row.cpc / 5);
  return Math.round(
    100 *
      (0.4 * volume +
        0.35 * ease +
        0.15 * value +
        0.1 * INTENT_BONUS[row.intent]),
  );
}
