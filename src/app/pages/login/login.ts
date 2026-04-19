import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

type Screen = 'welcome' | 'auth' | 'wizard';
type StepKey = 'tickers' | 'topics' | 'alerts';
type AuthMode = 'login' | 'register';

type Step = {
  key: StepKey;
  eyebrow: string;
  title: string;
  description: string;
};

type AlertPreference = {
  id: string;
  label: string;
  enabled: boolean;
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly router = inject(Router);

  protected screen: Screen = 'welcome';
  protected currentStep = 0;
  protected authMode: AuthMode = 'login';

  protected readonly steps: Step[] = [
    {
      key: 'tickers',
      eyebrow: 'Step 1 of 3',
      title: 'Pick your tickers',
      description: `Choose stocks to follow. You can always change these.`,
    },
    {
      key: 'topics',
      eyebrow: 'Step 2 of 3',
      title: 'Topics you care about',
      description: `We'll surface news in these areas even for stocks you don't follow.`,
    },
    {
      key: 'alerts',
      eyebrow: 'Step 3 of 3',
      title: 'Alert preferences',
      description: 'When should we notify you?',
    },
  ];

  protected readonly tickerOptions = ['NVDA', 'AAPL', 'BBVA', 'GOOG', 'TSLA', 'MSFT', 'AMZN', 'META'];
  protected readonly topicOptions = ['AI & chips', 'Interest rates', 'Energy', 'Regulation', 'Earnings', 'M&A'];

  protected readonly selectedTickers = new Set<string>(['NVDA', 'BBVA', 'MSFT']);
  protected readonly selectedTopics = new Set<string>(['AI & chips', 'Regulation']);

  protected alertPreferences: AlertPreference[] = [
    { id: 'price-moves', label: 'Big price moves (>3%)', enabled: true },
    { id: 'high-impact', label: 'High-impact news', enabled: true },
    { id: 'daily-digest', label: 'Daily digest (9am)', enabled: false },
  ];

  protected get activeStep(): Step {
    return this.steps[this.currentStep];
  }

  protected get isLastStep(): boolean {
    return this.currentStep === this.steps.length - 1;
  }

  protected startFlow(): void {
    this.authMode = 'login';
    this.screen = 'auth';
  }

  protected enterWizard(): void {
    this.screen = 'wizard';
  }

  protected setAuthMode(mode: AuthMode): void {
    this.authMode = mode;
  }

  protected goBack(): void {
    if (this.screen === 'auth') {
      this.screen = 'welcome';
      return;
    }

    if (this.currentStep > 0) {
      this.currentStep -= 1;
      return;
    }

    this.screen = 'auth';
  }

  protected continue(): void {
    if (this.isLastStep) {
      void this.router.navigate(['/portfolio']);
      return;
    }

    this.currentStep += 1;
  }

  protected toggleTicker(option: string): void {
    this.toggleSelection(this.selectedTickers, option);
  }

  protected toggleTopic(option: string): void {
    this.toggleSelection(this.selectedTopics, option);
  }

  protected isTickerSelected(option: string): boolean {
    return this.selectedTickers.has(option);
  }

  protected isTopicSelected(option: string): boolean {
    return this.selectedTopics.has(option);
  }

  protected toggleAlert(id: string): void {
    this.alertPreferences = this.alertPreferences.map((preference) =>
      preference.id === id
        ? { ...preference, enabled: !preference.enabled }
        : preference,
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
