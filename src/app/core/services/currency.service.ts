import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { MarketDataService } from './market-data.service';

/** Currencies the interface can display prices in. */
export type DisplayCurrency = 'USD' | 'EUR';

const CURRENCY_STORAGE_KEY = 'newsTracker.currency';

/** Result of a conversion: the currency is what the amount is ACTUALLY in. */
export type ConvertedAmount = {
  amount: number;
  currency: string;
};

/**
 * The currency prices are displayed in, and the FX rate needed to get there.
 *
 * Quotes arrive in their listing currency (USD for IBM, EUR for BBVA), so
 * showing everything in one currency needs a live rate. `convert` never
 * fabricates a number: if the rate hasn't loaded or the listing currency isn't
 * one of the two supported ones (a London listing in GBP, say), it returns the
 * original amount and its own currency so the UI labels it honestly.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly marketData = inject(MarketDataService);

  readonly currency = signal<DisplayCurrency>(this.readInitialCurrency());
  /** USD per 1 EUR (Yahoo's EURUSD=X); null until it loads, or after a failure. */
  private readonly eurUsdRate = signal<number | null>(null);
  private readonly rateLoading = signal(false);

  /** False while the rate is unknown, so views can explain a native-currency fallback. */
  readonly hasRate = computed(() => this.eurUsdRate() !== null);
  /**
   * True while a rate request is in flight, so views don't explain a fallback
   * that is about to resolve on its own.
   */
  readonly isRateLoading = computed(() => this.rateLoading());

  private rateRequested = false;

  constructor() {
    this.loadRate();
  }

  setCurrency(currency: DisplayCurrency): void {
    if (currency === this.currency()) {
      return;
    }

    this.currency.set(currency);

    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch {
      // Storage may be unavailable (private mode, quota); the choice still
      // applies to this session.
    }

    // A first attempt before sign-in gets a 401, so retry when the user
    // actually asks to see the other currency.
    if (!this.hasRate()) {
      this.rateRequested = false;
      this.loadRate();
    }
  }

  /** Convert `amount` from `sourceCurrency` into the selected display currency. */
  convert(amount: number, sourceCurrency: string): ConvertedAmount {
    const source = sourceCurrency.trim().toUpperCase();
    const target = this.currency();
    const rate = this.eurUsdRate();

    if (source === target || rate === null) {
      return { amount, currency: source };
    }

    if (source === 'EUR' && target === 'USD') {
      return { amount: amount * rate, currency: target };
    }

    if (source === 'USD' && target === 'EUR') {
      return { amount: amount / rate, currency: target };
    }

    // Any other listing currency (GBP, JPY, ...) has no rate here; show it as-is
    // rather than mislabelling it.
    return { amount, currency: source };
  }

  /**
   * Fetch the EUR/USD rate. Yahoo exposes it as the quotable symbol `EURUSD=X`,
   * so the existing market endpoint serves it — no extra backend surface.
   */
  private loadRate(): void {
    if (this.rateRequested) {
      return;
    }
    this.rateRequested = true;
    this.rateLoading.set(true);

    this.marketData
      .getCompanyMarketData('EURUSD=X', 1)
      .pipe(catchError(() => of(null)))
      .subscribe((response) => {
        this.rateLoading.set(false);
        const rate = response?.quote.price;

        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
          this.eurUsdRate.set(rate);
          return;
        }

        // Allow a later retry when the user switches currency.
        this.rateRequested = false;
      });
  }

  private readInitialCurrency(): DisplayCurrency {
    try {
      const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (stored === 'USD' || stored === 'EUR') {
        return stored;
      }
    } catch {
      // fall through to the default
    }

    return 'USD';
  }
}
