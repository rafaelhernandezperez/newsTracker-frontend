import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { COMPANIES } from '../../core/data/companies.data';
import { AlertPrefs, UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { PushService } from '../../core/services/push.service';
import { AlertPrefsService } from '../../core/services/alert-prefs.service';

type Screen = 'welcome' | 'auth' | 'wizard';
type StepKey = 'tickers' | 'alerts';
type AuthMode = 'login' | 'register';

type Step = {
  key: StepKey;
  eyebrow: string;
  title: string;
  description: string;
};

type AlertPreference = {
  id: keyof AlertPrefs;
  label: string;
  enabled: boolean;
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
      eyebrow: 'Step 1 of 2',
      title: 'Pick your tickers',
      description: `Choose stocks to follow. You can always change these.`,
    },
    {
      key: 'alerts',
      eyebrow: 'Step 2 of 2',
      title: 'Alert preferences',
      description: 'When should we notify you?',
    },
  ];

  // Keep the selectable tickers aligned with the company catalogue so every
  // choice has matching metadata and resolves to real backend data.
  protected readonly tickerOptions = COMPANIES.map((company) => company.symbol);

  protected readonly selectedTickers = new Set<string>(['NVDA', 'BBVA']);

  // Ids match the backend AlertPrefs fields; all on by default, mirroring the
  // server-side default for users who never save preferences.
  protected readonly alertPreferences = signal<AlertPreference[]>([
    { id: 'priceMoves', label: 'Big price moves (>3%)', enabled: true },
    { id: 'highImpact', label: 'High-impact news', enabled: true },
    { id: 'dailyDigest', label: 'Daily digest (9am)', enabled: true },
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
      this.authError.set('Introduce tu email y contraseña.');
      return;
    }

    if (this.authMode() === 'register' && this.password !== this.confirmPassword) {
      this.authError.set('Las contraseñas no coinciden.');
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
      return 'Configuración de Firebase incompleta (firebase.config.ts).';
    }
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email o contraseña incorrectos.';
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con este email.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'El email no es válido.';
      default:
        return 'No se pudo completar la operación. Inténtalo de nuevo.';
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
