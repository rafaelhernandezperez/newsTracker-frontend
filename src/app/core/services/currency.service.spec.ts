import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { MarketResponse } from '../models/market.model';
import { CurrencyService } from './currency.service';
import { MarketDataService } from './market-data.service';

/** Market stub serving one EURUSD=X quote: 1 EUR = 1.25 USD. */
function marketStub(rate: number | null) {
  return {
    getCompanyMarketData: (): Observable<MarketResponse> =>
      rate === null
        ? throwError(() => new Error('offline'))
        : of({
            ok: true,
            ticker: 'EURUSD=X',
            quote: { symbol: 'EURUSD=X', currency: 'USD', price: rate },
            chart: [],
            history: [],
          } as unknown as MarketResponse),
  };
}

function serviceWithRate(rate: number | null): CurrencyService {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [CurrencyService, { provide: MarketDataService, useValue: marketStub(rate) }],
  });
  return TestBed.inject(CurrencyService);
}

describe('CurrencyService', () => {
  it('defaults to USD and leaves same-currency amounts alone', () => {
    const service = serviceWithRate(1.25);
    expect(service.currency()).toBe('USD');
    expect(service.convert(100, 'USD')).toEqual({ amount: 100, currency: 'USD' });
  });

  it('converts a EUR listing into the selected USD', () => {
    const service = serviceWithRate(1.25);
    expect(service.convert(100, 'EUR')).toEqual({ amount: 125, currency: 'USD' });
  });

  it('converts a USD listing into the selected EUR', () => {
    const service = serviceWithRate(1.25);
    service.setCurrency('EUR');
    expect(service.convert(100, 'USD')).toEqual({ amount: 80, currency: 'EUR' });
  });

  it('leaves an unsupported listing currency in its own currency', () => {
    const service = serviceWithRate(1.25);
    service.setCurrency('EUR');
    // No GBP rate here — better untouched than mislabelled as euros.
    expect(service.convert(100, 'GBP')).toEqual({ amount: 100, currency: 'GBP' });
  });

  it('falls back to the listing currency when no rate could be loaded', () => {
    const service = serviceWithRate(null);
    expect(service.hasRate()).toBe(false);
    // Settled, not pending — the view may explain the fallback.
    expect(service.isRateLoading()).toBe(false);
    expect(service.convert(100, 'EUR')).toEqual({ amount: 100, currency: 'EUR' });
  });

  it('remembers the chosen currency across instances', () => {
    serviceWithRate(1.25).setCurrency('EUR');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CurrencyService, { provide: MarketDataService, useValue: marketStub(1.25) }],
    });
    expect(TestBed.inject(CurrencyService).currency()).toBe('EUR');
  });
});
