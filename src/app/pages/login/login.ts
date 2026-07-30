import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { COMPANIES } from '../../core/data/companies.data';
import { TranslationKey } from '../../core/i18n/translations';
import { AlertPrefs, UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { PushService } from '../../core/services/push.service';
import { AlertPrefsService } from '../../core/services/alert-prefs.service';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle';

type Screen = 'welcome' | 'auth' | 'wizard';
type StepKey = 'tickers' | 'alerts';
type AuthMode = 'login' | 'register';

type Step = {
  key: StepKey;
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
};

type AlertPreference = {
  id: keyof AlertPrefs;
  labelKey: TranslationKey;
  enabled: boolean;
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LanguageToggleComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly router = inject(Router);
  private readonly preferences = inject(UserPreferencesService);
  private readonly auth = inject(AuthService);
  private readonly watchlist = inject(WatchlistService);
  private readonly push = inject(PushService);
  private readonly alertPrefsApi = inject(AlertPrefsService);
  protected readonly i18n = inject(LanguageService);

  protected fullName = '';
  protected email = '';
  protected password = '';
  protected confirmPassword = '';
  // Signals so state mutated after `await` still triggers zoneless change detection.
  protected readonly authError = signal('');
  protected readonly authBusy = signal(false);

  protected readonly screen = signal<Screen>('welcome');
  protected readonly currentStep = signal(0);
  protected readonly authMode = signal<AuthMode>('login');

  protected readonly steps: Step[] = [
    {
      key: 'tickers',
      eyebrowKey: 'wizard.step1Eyebrow',
      titleKey: 'wizard.tickersTitle',
      descriptionKey: 'wizard.tickersDescription',
    },
    {
      key: 'alerts',
      eyebrowKey: 'wizard.step2Eyebrow',
      titleKey: 'wizard.alertsTitle',
      descriptionKey: 'wizard.alertsDescription',
    },
  ];

  // Keep the selectable tickers aligned with the company catalogue so every
  // choice has matching metadata and resolves to real backend data.
  protected readonly tickerOptions = COMPANIES.map((company) => company.symbol);

  protected readonly selectedTickers = new Set<string>(['NVDA', 'BBVA']);

  // Ids match the backend AlertPrefs fields; all on by default, mirroring the
  // server-side default for users who never save preferences.
  protected readonly alertPreferences = signal<AlertPreference[]>([
    { id: 'priceMoves', labelKey: 'alerts.priceMoves', enabled: true },
    { id: 'highImpact', labelKey: 'alerts.highImpact', enabled: true },
    { id: 'dailyDigest', labelKey: 'alerts.dailyDigest', enabled: true },
  ]);

  protected readonly activeStep = computed<Step>(() => this.steps[this.currentStep()]);

  protected readonly isLastStep = computed(() => this.currentStep() === this.steps.length - 1);

  protected startFlow(): void {
    this.authMode.set('login');
    this.screen.set('auth');
  }

  protected enterWizard(): void {
    this.screen.set('wizard');
  }

  protected setAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
  }

  protected goBack(): void {
    if (this.screen() === 'auth') {
      this.screen.set('welcome');
      return;
    }

    if (this.currentStep() > 0) {
      this.currentStep.update((step) => step - 1);
      return;
    }

    this.screen.set('auth');
  }

  /** Submit the email/password form: log in (existing user) or start onboarding. */
  protected async submitAuth(): Promise<void> {
    if (this.authBusy()) {
      return;
    }

    this.authError.set('');

    if (!this.email.trim() || !this.password) {
      this.authError.set(this.i18n.t('auth.missingCredentials'));
      return;
    }

    if (this.authMode() === 'register' && this.password !== this.confirmPassword) {
      this.authError.set(this.i18n.t('auth.passwordMismatch'));
      return;
    }

    this.authBusy.set(true);
    try {
      if (this.authMode() === 'login') {
        await this.auth.login(this.email.trim(), this.password);
        // Returning user: hydrate the local selection from their server watchlist.
        try {
          const companies = await this.watchlist.fetch();
          if (companies.length) {
            this.preferences.setCompanies(companies);
          }
        } catch {
          // Non-fatal: keep whatever is in local prefs.
        }
        // Same for alert preferences: the server copy is what the scheduled
        // jobs actually honor, so it wins over stale local state.
        try {
          this.preferences.setAlertPrefs(await this.alertPrefsApi.fetch());
        } catch {
          // Non-fatal: keep local/default prefs.
        }
        void this.push.enable();
        await this.router.navigate(['/portfolio']);
      } else {
        await this.auth.register(this.fullName, this.email.trim(), this.password);
        // New user: continue into the onboarding wizard to pick tickers.
        this.enterWizard();
      }
    } catch (error) {
      this.authError.set(this.authErrorMessage(error));
    } finally {
      this.authBusy.set(false);
    }
  }

  protected async continue(): Promise<void> {
    if (this.isLastStep()) {
      const companies = [...this.selectedTickers].map(
        (symbol) => COMPANIES.find((company) => company.symbol === symbol) ?? { symbol, name: symbol },
      );
      this.preferences.setCompanies(companies);

      const alertPrefs = Object.fromEntries(
        this.alertPreferences().map((preference) => [preference.id, preference.enabled]),
      ) as AlertPrefs;
      this.preferences.setAlertPrefs(alertPrefs);

      // Persist the selection + alert prefs server-side so the scheduled jobs
      // (digest, high-impact news, price moves) know what to send this user,
      // and enable push so the alerts can actually be delivered.
      try {
        await this.watchlist.sync(companies);
      } catch {
        // Non-fatal: the selection still lives locally.
      }
      try {
        await this.alertPrefsApi.sync(alertPrefs);
      } catch {
        // Non-fatal: the prefs still live locally; server keeps defaults.
      }
      void this.push.enable();

      void this.router.navigate(['/portfolio']);
      return;
    }

    this.currentStep.update((step) => step + 1);
  }

  private authErrorMessage(error: unknown): string {
    const code = (error as { code?: string })?.code ?? '';
    if (code === 'auth/invalid-api-key' || code.startsWith('auth/api-key-not-valid')) {
      return this.i18n.t('auth.firebaseMisconfigured');
    }
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return this.i18n.t('auth.invalidCredentials');
      case 'auth/email-already-in-use':
        return this.i18n.t('auth.emailInUse');
      case 'auth/weak-password':
        return this.i18n.t('auth.weakPassword');
      case 'auth/invalid-email':
        return this.i18n.t('auth.invalidEmail');
      default:
        return this.i18n.t('auth.generic');
    }
  }

  protected toggleTicker(option: string): void {
    this.toggleSelection(this.selectedTickers, option);
  }

  protected isTickerSelected(option: string): boolean {
    return this.selectedTickers.has(option);
  }

  protected toggleAlert(id: string): void {
    this.alertPreferences.update((preferences) =>
      preferences.map((preference) =>
        preference.id === id
          ? { ...preference, enabled: !preference.enabled }
          : preference,
      ),
    );
  }

  private toggleSelection(selection: Set<string>, value: string): void {
    if (selection.has(value)) {
      selection.delete(value);
      return;
    }

    selection.add(value);
  }
}
