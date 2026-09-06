/** Decorative quotes use real symbols and simulated prices, never live market data. */

type Trend = 'up' | 'down' | 'flat';

export type Quote = {
  readonly id: number;
  readonly symbol: string;
  readonly price: number;
  readonly priceText: string;
  readonly changeText: string;

  readonly trend: Trend;
  /** Flash only on the tick that updates the quote. */
  readonly flash: boolean;
};

const SYMBOLS = [
  'AAPL',
  'MSFT',
  'NVDA',
  'TSLA',
  'AMZN',
  'GOOGL',
  'META',
  'NFLX',
  'AMD',
  'INTC',
  'ORCL',
  'CRM',
  'ADBE',
  'IBM',
  'CSCO',
  'QCOM',
  'TXN',
  'AVGO',
  'MU',
  'ASML',
  'JPM',
  'GS',
  'MS',
  'BAC',
  'WFC',
  'C',
  'V',
  'MA',
  'AXP',
  'BLK',
  'BBVA',
  'SAN',
  'ITX',
  'IBE',
  'TEF',
  'REP',
  'FER',
  'AENA',
  'CLNX',
  'GRF',
  'XOM',
  'CVX',
  'OXY',
  'SLB',
  'BP',
  'SHEL',
  'TTE',
  'ENI',
  'EQNR',
  'COP',
  'JNJ',
  'PFE',
  'MRK',
  'LLY',
  'UNH',
  'ABBV',
  'AMGN',
  'GILD',
  'BMY',
  'CVS',
  'WMT',
  'HD',
  'MCD',
  'NKE',
  'SBUX',
  'KO',
  'PEP',
  'PG',
  'DIS',
  'COST',
  'BA',
  'CAT',
  'GE',
  'HON',
  'LMT',
  'RTX',
  'DE',
  'MMM',
  'UPS',
  'UNP',
  'SPX',
  'NDX',
  'INDU',
  'INDP',
  'NYSE',
  'VIX',
  'DAX',
  'CAC',
  'IBEX',
  'FTSE',
  'NKY',
  'HSI',
  'STOXX',
  'RUT',
  'TNX',
  'DXY',
  'BRNT',
  'WTI',
  'GOLD',
  'SILV',
  'GDX',
  'FANG',
  'DRG',
  'ICE',
  'SPMI',
  'GDM',
  'UTIL',
  'BKX',
  'XLE',
  'XLF',
];

const BIG_PRINT = new Set([
  'SPX',
  'NDX',
  'INDU',
  'INDP',
  'NYSE',
  'DAX',
  'CAC',
  'IBEX',
  'FTSE',
  'NKY',
  'HSI',
  'STOXX',
  'RUT',
  'SPMI',
  'GDM',
  'UTIL',
  'BKX',
  'GOLD',
]);

const FLAT_ODDS = 0.09;

export function createQuote(id: number): Quote {
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const price = BIG_PRINT.has(symbol) ? 1400 + Math.random() * 29000 : 12 + Math.random() * 780;
  const flat = Math.random() < FLAT_ODDS;
  const change = (Math.random() - 0.5) * 4.6;

  return {
    id,
    symbol,
    price,
    priceText: formatPrice(price),
    changeText: flat ? '0.00' : formatChange(change),
    trend: flat ? 'flat' : change >= 0 ? 'up' : 'down',
    flash: false,
  };
}

export function reprintQuote(quote: Quote): Quote {
  if (Math.random() < FLAT_ODDS) {
    return { ...quote, changeText: '0.00', trend: 'flat', flash: true };
  }

  const step = quote.price * (Math.random() * 0.006 + 0.0004);
  const direction = Math.random() < 0.5 ? 1 : -1;
  const price = Math.max(0.42, quote.price + step * direction);

  return {
    ...quote,
    price,
    priceText: formatPrice(price),
    changeText: formatChange((step / quote.price) * 100 * direction),
    trend: direction === 1 ? 'up' : 'down',
    flash: true,
  };
}

function formatPrice(price: number): string {
  return price >= 1000
    ? price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    : price.toFixed(2);
}

function formatChange(change: number): string {
  return `${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(2)}`;
}
