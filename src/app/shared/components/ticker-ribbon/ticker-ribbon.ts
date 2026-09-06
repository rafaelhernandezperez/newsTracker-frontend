import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { Quote, createQuote, reprintQuote } from '../../ticker/quote';

const QUOTE_COUNT = 26;

const TICK_MS = 260;

@Component({
  selector: 'app-ticker-ribbon',
  templateUrl: './ticker-ribbon.html',
  styleUrl: './ticker-ribbon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class TickerRibbonComponent implements OnDestroy {
  protected readonly quotes = signal<Quote[]>(
    Array.from({ length: QUOTE_COUNT }, (_, id) => createQuote(id)),
  );

  /** Repeat the ribbon twice for a seamless loop at -50%. */
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
