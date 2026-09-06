import { Component, inject } from '@angular/core';
import {
  AppLanguage,
  LanguageService,
  TranslationKey,
} from '../../../core/services/language.service';

type LanguageOption = {
  value: AppLanguage;

  code: string;

  nameKey: TranslationKey;
};

@Component({
  selector: 'app-language-toggle',
  templateUrl: './language-toggle.html',
  styleUrl: './language-toggle.css',
})
export class LanguageToggleComponent {
  protected readonly i18n = inject(LanguageService);

  protected readonly options: LanguageOption[] = [
    { value: 'en', code: 'EN', nameKey: 'lang.en' },
    { value: 'es', code: 'ES', nameKey: 'lang.es' },
  ];

  protected select(language: AppLanguage): void {
    this.i18n.setLanguage(language);
  }
}
