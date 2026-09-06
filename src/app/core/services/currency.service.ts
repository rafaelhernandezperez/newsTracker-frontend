import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { MarketDataService } from './market-data.service';

export type DisplayCurrency = 'USD' | 'EUR';

const CURRENCY_STORAGE_KEY = 'newsTracker.currency';

/** The returned currency always identifies the actual unit of the amount. */
type ConvertedAmount = {
  amount: number;
  currency: string;
};

/** Keep the original amount and currency when a conversion rate is unavailable. */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly marketData = inject(MarketDataService);

  readonly currency = signal<DisplayCurrency>(this.readInitialCurrency());
  /** USD per 1 EUR (Yahoo's EURUSD=X); null until it loads, or after a failure. */
  private readonly eurUsdRate = signal<number | null>(null);
  private readonly rateLoading = signal(false);

  readonly hasRate = computed(() => this.eurUsdRate() !== null);

  readonly isRateLoading = this.rateLoading.asReadonly();

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
      // Keep the in-memory preference when storage is unavailable.
    }

    // Retry after sign-in if the initial rate request was unauthorized.
    if (!this.hasRate()) {
      this.rateRequested = false;
      this.loadRate();
    }
  }

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

    return { amount, currency: source };
  }

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
      // Ignore unavailable or invalid stored preferences.
    }

    return 'USD';
  }
}
