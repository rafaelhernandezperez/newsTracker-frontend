import { Component, inject } from '@angular/core';
import {
  AppLanguage,
  LanguageService,
  TranslationKey,
} from '../../../core/services/language.service';

type LanguageOption = {
  value: AppLanguage;
  /** Two-letter code shown in the pill. */
  code: string;
  /** Full language name, used for the accessible label and tooltip. */
  nameKey: TranslationKey;
};

/**
 * Compact segmented control for the interface language. Styled to sit inside the
 * app top bar next to the nav links (same pill radius, muted/active treatment),
 * so it reads as part of the navigation instead of a floating widget.
 */
@Component({
  selector: 'app-language-toggle',
  standalone: true,
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
