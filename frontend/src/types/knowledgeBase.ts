export type KBSearchMode = 'none' | 'keyword_only' | 'partial_semantic' | 'semantic_and_keyword'

export interface KBDocument {
  id: number;
  title: string;
  source?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  chunk_count?: number;
  embedded_chunk_count?: number;
  searchable?: boolean;
  search_mode?: KBSearchMode;
}

export interface KBSearchResult {
  document_id: number;
  document_title: string | null;
  chunk_text: string;
  score: number;
}
