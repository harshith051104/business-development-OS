export interface KBDocument {
  id: number;
  title: string;
  source?: string | null;
  created_by?: number | null;
  created_at: string;
  chunk_count?: number;
}

export interface KBSearchResult {
  document_id: number;
  document_title: string | null;
  chunk_text: string;
  score: number;
}
