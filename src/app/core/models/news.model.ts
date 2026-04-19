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
}

export interface NewsResponse {
  ok: boolean;
  ticker: string;
  count: number;
  items: NewsItem[];
}
