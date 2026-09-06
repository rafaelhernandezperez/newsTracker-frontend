import { Injectable, computed, inject, signal } from '@angular/core';
import { LanguageService } from './language.service';

@Injectable({
  providedIn: 'root',
})
export class ClockService {
  private readonly i18n = inject(LanguageService);
  private readonly now = signal(new Date());

  readonly time = computed(() =>
    new Intl.DateTimeFormat(this.i18n.locale(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(this.now()),
  );

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
