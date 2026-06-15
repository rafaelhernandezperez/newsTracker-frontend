export type NewsImportance = 'MUY_IMPORTANTE' | 'IMPORTANTE' | 'NEUTRO' | 'POCO_RELEVANTE';
export type NewsSentiment = 'POSITIVO' | 'NEGATIVO' | 'NEUTRO';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  summary?: string;
  pubDate?: string;
  isoDate?: string;
  language?: string;
  matchedTickers: string[];
  score: number;
  /** AI-classified market impact. Drives the chart marker size. */
  importance?: NewsImportance;
  /** AI-classified tone. Drives the chart marker color. */
  sentiment?: NewsSentiment;
}

export interface NewsResponse {
  ok: boolean;
  ticker: string;
  count: number;
  items: NewsItem[];
}
