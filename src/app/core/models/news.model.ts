export type NewsImportance = 'MUY_IMPORTANTE' | 'IMPORTANTE' | 'NEUTRO' | 'POCO_RELEVANTE';
export type NewsSentiment = 'POSITIVO' | 'NEGATIVO' | 'NEUTRO';

export interface NewsItem {
  id: string;
  title: string;
  localizedTitle?: string;
  link: string;
  source: string;
  summary?: string;
  pubDate?: string;
  isoDate?: string;
  language?: string;
  matchedTickers: string[];
  score: number;
  /** AI summary in the language selected for the interface. */
  aiSummary?: string;
  /** Market impact controls chart marker size. */
  importance?: NewsImportance;
  /** Sentiment controls chart marker color. */
  sentiment?: NewsSentiment;
}

export interface NewsResponse {
  ok: boolean;
  ticker: string;
  count: number;
  items: NewsItem[];
}
