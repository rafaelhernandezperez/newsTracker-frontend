import { Injectable, computed, inject, signal } from '@angular/core';
import { LanguageService } from './language.service';

/**
 * The exchange clock the chrome runs on.
 *
 * One ticker for the whole app: every screen that shows the time reads the
 * same second, and no component has to own an interval to do it.
 */
@Injectable({
  providedIn: 'root',
})
export class ClockService {
  private readonly i18n = inject(LanguageService);
  private readonly now = signal(new Date());

  /** Wall clock, 24h ("21:34:02"). */
  readonly time = computed(() =>
    new Intl.DateTimeFormat(this.i18n.locale(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(this.now()),
  );

  /** Long date in caps ("FRIDAY, 7 AUGUST 2026"). */
  readonly date = computed(() =>
    new Intl.DateTimeFormat(this.i18n.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
      .format(this.now())
      .toUpperCase(),
  );

  constructor() {
    setInterval(() => this.now.set(new Date()), 1000);
  }
}
