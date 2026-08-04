export interface RetrievalChunkDiagnostic {
  id: string;
  content: string;
  similarity: number;
  score: number;
  documentTitle: string | null;
  documentUrl?: string | null;
}

export interface RetrievalRejectedChunk {
  id: string;
  content: string;
  similarity: number;
  score: number;
  documentTitle: string | null;
}

export interface RetrievalDiagnosticDto {
  query: string;
  sufficient: boolean;
  maxSimilarity: number;
  threshold: number;
  topK: number;
  candidateK: number;
  selectedCount: number;
  candidateCount: number;
  chunks: RetrievalChunkDiagnostic[];
  rejected: RetrievalRejectedChunk[];
}
