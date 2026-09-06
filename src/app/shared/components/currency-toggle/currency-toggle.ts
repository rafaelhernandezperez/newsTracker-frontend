import { Component, inject } from '@angular/core';
import { CurrencyService, DisplayCurrency } from '../../../core/services/currency.service';
import { LanguageService, TranslationKey } from '../../../core/services/language.service';

type CurrencyOption = {
  value: DisplayCurrency;

  code: string;

  nameKey: TranslationKey;
};

@Component({
  selector: 'app-currency-toggle',
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
