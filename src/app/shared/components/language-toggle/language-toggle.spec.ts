import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../core/services/language.service';
import { LanguageToggleComponent } from './language-toggle';

/** Host with one translated string, to prove views re-render on a switch. */
@Component({
  standalone: true,
  imports: [LanguageToggleComponent],
  template: '<h1>{{ i18n.t("dashboard.title") }}</h1><app-language-toggle />',
})
class HostComponent {
  readonly i18n = inject(LanguageService);
}

describe('LanguageToggleComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let language: LanguageService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    language = TestBed.inject(LanguageService);
    language.setLanguage('en');
    await fixture.whenStable();
  });

  function buttonFor(code: string): HTMLButtonElement {
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.nt-segmented-option',
      ),
    ];
    const button = buttons.find((candidate) => candidate.textContent?.trim() === code);
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  }

  it('marks the current language as pressed', () => {
    expect(buttonFor('EN').getAttribute('aria-pressed')).toBe('true');
    expect(buttonFor('ES').getAttribute('aria-pressed')).toBe('false');
  });

  it('re-renders translated copy when another language is picked', async () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Latest company news');

    buttonFor('ES').click();
    await fixture.whenStable();

    expect(language.language()).toBe('es');
    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Últimas noticias de tus empresas');
    expect(buttonFor('ES').getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.lang).toBe('es');
  });
});
