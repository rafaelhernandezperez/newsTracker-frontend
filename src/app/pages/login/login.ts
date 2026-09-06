import { Component, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { COMPANIES } from '../../core/data/companies.data';
import { TranslationKey } from '../../core/i18n/translations';
import { AlertPrefs, UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';
import { ClockService } from '../../core/services/clock.service';
import { LanguageService } from '../../core/services/language.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { PushEnableResult, PushService } from '../../core/services/push.service';
import { AlertPrefsService } from '../../core/services/alert-prefs.service';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle';
import { TickerBoardComponent } from '../../shared/components/ticker-board/ticker-board';
import { TickerRibbonComponent } from '../../shared/components/ticker-ribbon/ticker-ribbon';

type Screen = 'welcome' | 'auth' | 'wizard';
type StepKey = 'tickers' | 'alerts';
type AuthMode = 'login' | 'register';
type PushSetupState = 'idle' | 'enabling' | PushEnableResult;

type Step = {
  key: StepKey;

  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
};

type AlertPreference = {
  id: keyof AlertPrefs;
  labelKey: TranslationKey;
  enabled: boolean;
};

const LAUNCH_MS = 1000;

@Component({
  selector: 'app-login',
  imports: [FormsModule, LanguageToggleComponent, TickerBoardComponent, TickerRibbonComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnDestroy {
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
  protected readonly authError = signal('');
  protected readonly authBusy = signal(false);
  protected readonly setupBusy = signal(false);
  protected readonly pushSetupState = signal<PushSetupState>('idle');
  protected readonly pushSkipped = signal(false);

  protected readonly screen = signal<Screen>('welcome');
  protected readonly currentStep = signal(0);
  protected readonly authMode = signal<AuthMode>('login');

  private readonly board = viewChild(TickerBoardComponent);

  protected readonly launching = signal(false);
  private launchTimer?: ReturnType<typeof setTimeout>;

  private readonly clockService = inject(ClockService);
  protected readonly clock = this.clockService.time;
  protected readonly today = this.clockService.date;

  protected readonly steps: Step[] = [
    {
      key: 'tickers',
      labelKey: 'wizard.tickersLabel',
      descriptionKey: 'wizard.tickersDescription',
    },
    {
      key: 'alerts',
      labelKey: 'wizard.alertsLabel',
      descriptionKey: 'wizard.alertsDescription',
    },
  ];

  protected readonly companies = COMPANIES;

  protected readonly selectedTickers = signal<ReadonlySet<string>>(new Set(['NVDA', 'BBVA']));

  protected readonly alertPreferences = signal<AlertPreference[]>([
    { id: 'priceMoves', labelKey: 'alerts.priceMoves', enabled: true },
    { id: 'highImpact', labelKey: 'alerts.highImpact', enabled: true },
    { id: 'dailyDigest', labelKey: 'alerts.dailyDigest', enabled: true },
  ]);

  protected readonly activeStep = computed<Step>(() => this.steps[this.currentStep()]);

  protected readonly isLastStep = computed(() => this.currentStep() === this.steps.length - 1);

  protected readonly wantsNotifications = computed(() =>
    this.alertPreferences().some((preference) => preference.enabled),
  );

  protected readonly stepTally = computed(() =>
    this.activeStep().key === 'tickers'
      ? this.i18n.t('wizard.selectedCount', { count: this.selectedTickers().size })
      : this.i18n.t('wizard.enabledCount', {
          count: this.alertPreferences().filter((preference) => preference.enabled).length,
        }),
  );

  protected startFlow(): void {
    if (this.launching()) {
      return;
    }

    const board = this.board();
    if (!board) {
      this.enterAuth();
      return;
    }

    this.launching.set(true);
    board.blast();
    this.launchTimer = setTimeout(() => this.enterAuth(), LAUNCH_MS);
  }

  private enterAuth(): void {
    this.authMode.set('login');
    this.screen.set('auth');
    this.launching.set(false);
  }

  ngOnDestroy(): void {
    clearTimeout(this.launchTimer);
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
        try {
          const companies = await this.watchlist.fetch();
          if (companies.length) {
            this.preferences.setCompanies(companies);
          }
        } catch {
          // Keep local preferences if the server is unavailable.
        }
        try {
          this.preferences.setAlertPrefs(await this.alertPrefsApi.fetch());
        } catch {
          // Keep local preferences if the server is unavailable.
        }
        await this.router.navigate(['/portfolio']);
      } else {
        await this.auth.register(this.fullName, this.email.trim(), this.password);
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
      if (this.setupBusy() || this.pushSetupState() === 'enabling') {
        return;
      }

      // Request permission before awaiting API work to preserve the button’s user activation.
      const shouldEnablePush = this.wantsNotifications() && !this.pushSkipped();
      const pushAttempt =
        shouldEnablePush && this.pushSetupState() !== 'enabled'
          ? this.enablePushFromGesture()
          : undefined;

      this.setupBusy.set(true);
      const companies = [...this.selectedTickers()].map(
        (symbol) =>
          COMPANIES.find((company) => company.symbol === symbol) ?? { symbol, name: symbol },
      );
      this.preferences.setCompanies(companies);

      const alertPrefs = Object.fromEntries(
        this.alertPreferences().map((preference) => [preference.id, preference.enabled]),
      ) as AlertPrefs;
      this.preferences.setAlertPrefs(alertPrefs);

      try {
        await this.watchlist.sync(companies);
      } catch {
        // Keep local preferences if the server is unavailable.
      }
      try {
        await this.alertPrefsApi.sync(alertPrefs);
      } catch {
        // Keep local preferences if the server is unavailable.
      }
      const pushResult = pushAttempt ? await pushAttempt : this.pushSetupState();
      if (shouldEnablePush && pushResult !== 'enabled') {
        // Keep failed push setup visible so the user can retry or skip it.
        this.setupBusy.set(false);
        return;
      }

      await this.router.navigate(['/portfolio']);
      this.setupBusy.set(false);
      return;
    }

    this.currentStep.update((step) => step + 1);
  }

  protected continueWithoutPush(): void {
    this.pushSkipped.set(true);
    void this.continue();
  }

  private enablePushFromGesture(): Promise<PushEnableResult> {
    this.pushSetupState.set('enabling');
    // Call enable() before any await to preserve the browser’s user activation.
    const attempt = this.push.enable();
    return attempt.then((result) => {
      this.pushSetupState.set(result);
      return result;
    });
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

  protected goToStep(index: number): void {
    this.currentStep.set(index);
  }

  protected toggleTicker(option: string): void {
    this.selectedTickers.update((selection) => {
      const next = new Set(selection);

      if (!next.delete(option)) {
        next.add(option);
      }

      return next;
    });
  }

  protected isTickerSelected(option: string): boolean {
    return this.selectedTickers().has(option);
  }

  protected toggleAlert(id: string): void {
    this.alertPreferences.update((preferences) =>
      preferences.map((preference) =>
        preference.id === id ? { ...preference, enabled: !preference.enabled } : preference,
      ),
    );
  }
}
