import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { Quote, createQuote, reprintQuote } from '../../ticker/quote';

/** Quotes in one pass of the ribbon; the pass is rendered twice to loop. */
const QUOTE_COUNT = 26;

/** Slower than the landing board — this screen is meant to feel calm. */
const TICK_MS = 260;

/**
 * The single line of quotes that runs along the bottom of the auth screens.
 *
 * Same feed and same colours as the landing board, reduced to one calm strip:
 * the market is still out there, it just stopped shouting.
 */
@Component({
  selector: 'app-ticker-ribbon',
  standalone: true,
  templateUrl: './ticker-ribbon.html',
  styleUrl: './ticker-ribbon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class TickerRibbonComponent implements OnDestroy {
  protected readonly quotes = signal<Quote[]>(
    Array.from({ length: QUOTE_COUNT }, (_, id) => createQuote(id)),
  );

  /** Two identical passes make the scroll seamless at -50%. */
  protected readonly passes = [0, 1];

  private flashed: number[] = [];
  private readonly timer?: ReturnType<typeof setInterval>;

  constructor() {
    if (!this.prefersReducedMotion()) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private tick(): void {
    const next = [...this.quotes()];

    for (const index of this.flashed) {
      next[index] = { ...next[index], flash: false };
    }
    this.flashed = [];

    const moves = 1 + Math.floor(Math.random() * 2);
    for (let move = 0; move < moves; move += 1) {
      const index = Math.floor(Math.random() * next.length);
      next[index] = reprintQuote(next[index]);
      this.flashed.push(index);
    }

    this.quotes.set(next);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
