import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Quote, createQuote, reprintQuote } from '../../ticker/quote';

const TICK_MS = 140;

/** Keep cell dimensions aligned with the desktop and mobile CSS. */
const CELL_WIDTH_PX = 300;
const CELL_HEIGHT_PX = 48;
const NARROW_WIDTH_PX = 640;
const NARROW_CELL_WIDTH_PX = 190;
const NARROW_CELL_HEIGHT_PX = 40;

/** Overscan prevents the drifting board from exposing an empty edge. */
const BOARD_OVERSCAN = 1.3;

@Component({
  selector: 'app-ticker-board',
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
  protected readonly cells = signal<Quote[]>([]);
  protected readonly blasting = signal(false);
  protected readonly gridColumns = computed(() => `repeat(${this.columns()}, minmax(0, 1fr))`);

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

  private layout(): void {
    const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const height = typeof window === 'undefined' ? 800 : window.innerHeight;

    const narrow = width < NARROW_WIDTH_PX;
    const cellWidth = narrow ? NARROW_CELL_WIDTH_PX : CELL_WIDTH_PX;
    const cellHeight = narrow ? NARROW_CELL_HEIGHT_PX : CELL_HEIGHT_PX;

    // Round columns to avoid clipping quote values at the viewport edge.
    const columns = Math.max(1, Math.round(width / cellWidth));
    const rows = Math.max(6, Math.ceil((height * BOARD_OVERSCAN) / cellHeight));
    const total = columns * rows;

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
              createQuote(cells.length + index),
            ),
          ];
    });
  }

  /** Read all cell positions before writing animation styles to avoid layout thrashing. */
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
      next[index] = reprintQuote(next[index]);
      this.flashed.push(index);
    }

    this.cells.set(next);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
