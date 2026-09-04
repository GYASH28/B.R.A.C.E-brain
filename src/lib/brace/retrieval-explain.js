"use strict";

function ordinalRank(value) {
  const rank = Number(value);
  return Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : null;
}

function similarityPercent(value) {
  const similarity = Number(value);
  if (!Number.isFinite(similarity) || similarity < 0) return null;
  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
}

function explainRetrieval(retrieval, mode = "lexical") {
  const lexicalRank = ordinalRank(retrieval?.lexicalRank);
  const semanticRank = ordinalRank(retrieval?.semanticRank);
  const semanticSimilarity = similarityPercent(retrieval?.semanticSimilarity);
  const normalizedMode = ["lexical", "semantic", "hybrid"].includes(mode) ? mode : "lexical";

  const signals = [];
  if (lexicalRank) signals.push(`lexical #${lexicalRank}`);
  if (semanticRank) signals.push(`semantic #${semanticRank}`);
  if (semanticSimilarity !== null) signals.push(`${semanticSimilarity}% semantic similarity`);

  let label = "Local relevance";
  if (normalizedMode === "hybrid" && lexicalRank && semanticRank) {
    label = `Hybrid · lexical #${lexicalRank} + semantic #${semanticRank}`;
  } else if (normalizedMode === "semantic" || (!lexicalRank && semanticRank)) {
    label = semanticSimilarity !== null
      ? `Semantic · ${semanticSimilarity}% similar`
      : `Semantic · rank #${semanticRank || 1}`;
  } else if (lexicalRank) {
    label = `Lexical · rank #${lexicalRank}`;
  }

  return {
    mode: normalizedMode,
    label,
    detail: signals.length ? signals.join(" · ") : "Ranked from the local BRACE index.",
    lexicalRank,
    semanticRank,
    semanticSimilarity,
  };
}

module.exports = { explainRetrieval, similarityPercent };
