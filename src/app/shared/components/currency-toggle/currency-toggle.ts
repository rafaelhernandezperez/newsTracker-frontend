import { Component, inject } from '@angular/core';
import { CurrencyService, DisplayCurrency } from '../../../core/services/currency.service';
import { LanguageService, TranslationKey } from '../../../core/services/language.service';

type CurrencyOption = {
  value: DisplayCurrency;
  /** ISO code shown in the pill. */
  code: string;
  /** Full currency name, used for the accessible label and tooltip. */
  nameKey: TranslationKey;
};

/**
 * Segmented control for the currency prices are shown in. Same pill as the
 * language switcher (shared .nt-segmented styles), sized to sit in the chart
 * controls row next to the timeframe tabs.
 */
@Component({
  selector: 'app-currency-toggle',
  standalone: true,
  templateUrl: './currency-toggle.html',
  styleUrl: './currency-toggle.css',
})
export class CurrencyToggleComponent {
  protected readonly i18n = inject(LanguageService);
  protected readonly currencyService = inject(CurrencyService);

  protected readonly options: CurrencyOption[] = [
    { value: 'USD', code: 'US$', nameKey: 'currency.usd' },
    { value: 'EUR', code: '€', nameKey: 'currency.eur' },
  ];

  protected select(currency: DisplayCurrency): void {
    this.currencyService.setCurrency(currency);
  }
}
