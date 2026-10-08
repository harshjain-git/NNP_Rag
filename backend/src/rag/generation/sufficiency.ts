import type { RetrievedChunk } from "../retrieval/types.js";
import { DEFAULT_MIN_SUFFICIENCY_SCORE } from "../../config/rag.js";
import type { EvidenceSufficiencyResult } from "./types.js";

export const checkEvidenceSufficiency = (
  chunks: RetrievedChunk[],
  minSufficiencyScore: number = DEFAULT_MIN_SUFFICIENCY_SCORE
): EvidenceSufficiencyResult => {
  if (chunks.length === 0) {
    return {
      isSufficient: false,
      reason: "No relevant documents or chunks were retrieved for the query.",
      topSimilarity: 0,
      retrievedCount: 0,
    };
  }

  const topSimilarity = chunks[0]?.similarity ?? 0;
  if (topSimilarity < minSufficiencyScore) {
    return {
      isSufficient: false,
      reason: `Top retrieval similarity (${topSimilarity.toFixed(4)}) is below the required sufficiency threshold (${minSufficiencyScore.toFixed(4)}).`,
      topSimilarity,
      retrievedCount: chunks.length,
    };
  }

  return {
    isSufficient: true,
    topSimilarity,
    retrievedCount: chunks.length,
  };
};
