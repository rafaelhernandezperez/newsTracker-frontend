import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';

/**
 * One quote line on the board.
 *
 * The symbols are real, the numbers are not: this is set dressing for the
 * landing page, never market data. Display strings are precomputed on every
 * tick so the template stays binding-only for a few hundred cells.
 */
type Trend = 'up' | 'down' | 'flat';

type Cell = {
  readonly id: number;
  readonly symbol: string;
  readonly price: number;
  readonly priceText: string;
  readonly changeText: string;
  /** Last move — colours the whole line green, red, or white when unchanged. */
  readonly trend: Trend;
  /** True for one tick after a move, so the cell flashes and then decays. */
  readonly flash: boolean;
};

/** Tickers, indices and commodities, in the shorthand a trading screen uses. */
const SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'NFLX', 'AMD', 'INTC',
  'ORCL', 'CRM', 'ADBE', 'IBM', 'CSCO', 'QCOM', 'TXN', 'AVGO', 'MU', 'ASML',
  'JPM', 'GS', 'MS', 'BAC', 'WFC', 'C', 'V', 'MA', 'AXP', 'BLK',
  'BBVA', 'SAN', 'ITX', 'IBE', 'TEF', 'REP', 'FER', 'AENA', 'CLNX', 'GRF',
  'XOM', 'CVX', 'OXY', 'SLB', 'BP', 'SHEL', 'TTE', 'ENI', 'EQNR', 'COP',
  'JNJ', 'PFE', 'MRK', 'LLY', 'UNH', 'ABBV', 'AMGN', 'GILD', 'BMY', 'CVS',
  'WMT', 'HD', 'MCD', 'NKE', 'SBUX', 'KO', 'PEP', 'PG', 'DIS', 'COST',
  'BA', 'CAT', 'GE', 'HON', 'LMT', 'RTX', 'DE', 'MMM', 'UPS', 'UNP',
  'SPX', 'NDX', 'INDU', 'INDP', 'NYSE', 'VIX', 'DAX', 'CAC', 'IBEX', 'FTSE',
  'NKY', 'HSI', 'STOXX', 'RUT', 'TNX', 'DXY', 'BRNT', 'WTI', 'GOLD', 'SILV',
  'GDX', 'FANG', 'DRG', 'ICE', 'SPMI', 'GDM', 'UTIL', 'BKX', 'XLE', 'XLF',
];

/** Symbols that print in index territory rather than share-price territory. */
const BIG_PRINT = new Set([
  'SPX', 'NDX', 'INDU', 'INDP', 'NYSE', 'DAX', 'CAC', 'IBEX', 'FTSE', 'NKY',
  'HSI', 'STOXX', 'RUT', 'SPMI', 'GDM', 'UTIL', 'BKX', 'GOLD',
]);

/** How often a handful of quotes reprint. Fast enough to feel alive. */
const TICK_MS = 140;

/**
 * Approximate cell footprint, used to fill the viewport without measuring.
 * Phones get the smaller pair, matching the type scale in the stylesheet.
 */
const CELL_WIDTH_PX = 300;
const CELL_HEIGHT_PX = 48;
const NARROW_WIDTH_PX = 640;
const NARROW_CELL_WIDTH_PX = 190;
const NARROW_CELL_HEIGHT_PX = 40;

/** Share of quotes printing unchanged — those are the white lines on the wall. */
const FLAT_ODDS = 0.09;

/** The board overflows the viewport so its slow drift never exposes an edge. */
const BOARD_OVERSCAN = 1.3;

@Component({
  selector: 'app-ticker-board',
  standalone: true,
  templateUrl: './ticker-board.html',
  styleUrl: './ticker-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.is-blasting]': 'blasting()',
  },
})
export class TickerBoardComponent implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reducedMotion = this.prefersReducedMotion();

  protected readonly columns = signal(6);
  protected readonly cells = signal<Cell[]>([]);
  protected readonly blasting = signal(false);
  protected readonly gridColumns = computed(() => `repeat(${this.columns()}, minmax(0, 1fr))`);

  /** Indices flashed on the previous tick, cleared on the next one. */
  private flashed: number[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private resizeTimer?: ReturnType<typeof setTimeout>;

  private readonly onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.layout(), 200);
  };

  constructor() {
    this.layout();

    if (!this.reducedMotion) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Fill the viewport — recomputed on resize so a rotation never leaves gaps. */
  private layout(): void {
    const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const height = typeof window === 'undefined' ? 800 : window.innerHeight;

    const narrow = width < NARROW_WIDTH_PX;
    const cellWidth = narrow ? NARROW_CELL_WIDTH_PX : CELL_WIDTH_PX;
    const cellHeight = narrow ? NARROW_CELL_HEIGHT_PX : CELL_HEIGHT_PX;

    // Rounded, not ceiled: a part-width column would clip its own change value.
    const columns = Math.max(1, Math.round(width / cellWidth));
    const rows = Math.max(6, Math.ceil((height * BOARD_OVERSCAN) / cellHeight));
    const total = columns * rows;

    // Indices from the previous layout no longer point anywhere useful.
    this.flashed = [];
    this.columns.set(columns);
    this.cells.update((cells) => {
      if (cells.length === total) {
        return cells;
      }

      return cells.length > total
        ? cells.slice(0, total)
        : [
            ...cells,
            ...Array.from({ length: total - cells.length }, (_, index) =>
              this.seed(cells.length + index),
            ),
          ];
    });
  }

  /**
   * Blow the board apart: every quote is thrown outward from the centre of the
   * screen, nearest first, so the clutter clears as a shockwave. Vectors come
   * from the live layout (one read pass, then one write pass) so the explosion
   * radiates from wherever each cell actually sits.
   */
  blast(): void {
    if (this.blasting()) {
      return;
    }

    this.stop();

    const nodes = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.cell'));
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const maxDistance = Math.hypot(centerX, centerY) || 1;

    const rects = nodes.map((node) => node.getBoundingClientRect());

    nodes.forEach((node, index) => {
      const rect = rects[index];
      const offsetX = rect.left + rect.width / 2 - centerX;
      const offsetY = rect.top + rect.height / 2 - centerY;
      const distance = Math.hypot(offsetX, offsetY) || 1;
      const force = 0.85 + Math.random() * 0.9;

      node.style.setProperty('--dx', `${(offsetX / distance) * centerX * 1.35 * force}px`);
      node.style.setProperty('--dy', `${(offsetY / distance) * centerY * 1.5 * force}px`);
      node.style.setProperty('--rot', `${(Math.random() - 0.5) * 44}deg`);
      node.style.setProperty('--scale', `${1.5 + Math.random() * 1.3}`);
      node.style.setProperty('--delay', `${(distance / maxDistance) * 170}ms`);
    });

    this.blasting.set(true);
  }

  private stop(): void {
    clearInterval(this.timer);
    clearTimeout(this.resizeTimer);
    this.timer = undefined;

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
  }

  /** Reprint a few random quotes, and let last tick's flashes decay. */
  private tick(): void {
    const next = [...this.cells()];

    for (const index of this.flashed) {
      if (next[index]) {
        next[index] = { ...next[index], flash: false };
      }
    }
    this.flashed = [];

    const moves = 5 + Math.floor(Math.random() * 6);
    for (let move = 0; move < moves; move += 1) {
      const index = Math.floor(Math.random() * next.length);
      const cell = next[index];

      // An unchanged reprint: the line goes white until it moves again.
      if (Math.random() < FLAT_ODDS) {
        next[index] = { ...cell, changeText: '0.00', trend: 'flat', flash: true };
        this.flashed.push(index);
        continue;
      }

      const step = cell.price * (Math.random() * 0.006 + 0.0004);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const price = Math.max(0.42, cell.price + step * direction);

      next[index] = {
        ...cell,
        price,
        priceText: this.formatPrice(price),
        changeText: this.formatChange((step / cell.price) * 100 * direction),
        trend: direction === 1 ? 'up' : 'down',
        flash: true,
      };
      this.flashed.push(index);
    }

    this.cells.set(next);
  }

  private seed(id: number): Cell {
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const price = BIG_PRINT.has(symbol)
      ? 1400 + Math.random() * 29000
      : 12 + Math.random() * 780;
    const flat = Math.random() < FLAT_ODDS;
    const change = (Math.random() - 0.5) * 4.6;

    return {
      id,
      symbol,
      price,
      priceText: this.formatPrice(price),
      changeText: flat ? '0.00' : this.formatChange(change),
      trend: flat ? 'flat' : change >= 0 ? 'up' : 'down',
      flash: false,
    };
  }

  /** Board convention: big prints lose the decimals, small ones keep two. */
  private formatPrice(price: number): string {
    return price >= 1000
      ? price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
      : price.toFixed(2);
  }

  private formatChange(change: number): string {
    return `${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(2)}`;
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
