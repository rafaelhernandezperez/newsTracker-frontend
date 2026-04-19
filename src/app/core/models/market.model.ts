export interface MarketQuote {
  symbol: string;
  currency?: string | null;
  price: number;
  change: number;
  volume: number;
  marketCap?: number | null;
  trailingPE?: number | null;
  open?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
}

export interface MarketChartPoint {
  date: string;
  value: number;
}

export interface MarketHistoryPoint {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}

export interface MarketResponse {
  ok: boolean;
  ticker: string;
  quote: MarketQuote;
  chart: MarketChartPoint[];
  history: MarketHistoryPoint[];
}

export interface RawMarketResponse {
  ok?: boolean;
  ticker?: string;
  quote?: Partial<MarketQuote> | null;
  chart?: unknown;
  history?: unknown;
}
