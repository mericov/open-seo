import {
  deleteSavedKeywordTag,
  getSavedKeywords,
  getSerpAnalysis,
  removeSavedKeywords,
  research,
  saveKeywords,
  exportSavedKeywords,
  updateSavedKeywordTag,
  updateSavedKeywordTags,
  refreshSavedKeywordMetrics,
} from "@/server/features/keywords/services/research";
import { KeywordResearchRepository } from "@/server/features/keywords/repositories/KeywordResearchRepository";

export const KeywordResearchService = {
  research,
  listSavedKeywordNames: KeywordResearchRepository.listSavedKeywordNames,
  getSerpAnalysis,
  saveKeywords,
  getSavedKeywords,
  exportSavedKeywords,
  updateSavedKeywordTags,
  updateSavedKeywordTag,
  deleteSavedKeywordTag,
  removeSavedKeywords,
  refreshSavedKeywordMetrics,
} as const;
