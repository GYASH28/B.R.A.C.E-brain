export interface RetrievalSignal {
  score?: number;
  lexicalRank: number | null;
  semanticRank: number | null;
  semanticSimilarity: number | null;
}

export interface RetrievalExplanation {
  mode: "lexical" | "semantic" | "hybrid";
  label: string;
  detail: string;
  lexicalRank: number | null;
  semanticRank: number | null;
  semanticSimilarity: number | null;
}

export function similarityPercent(value: unknown): number | null;
export function explainRetrieval(
  retrieval: Partial<RetrievalSignal> | null | undefined,
  mode?: "lexical" | "semantic" | "hybrid",
): RetrievalExplanation;
