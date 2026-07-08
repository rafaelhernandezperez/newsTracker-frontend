import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertPrefs, DEFAULT_ALERT_PREFS } from './user-preferences.service';

type AlertPrefsResponse = {
  ok: boolean;
  prefs?: Partial<AlertPrefs>;
};

/**
 * Mirrors the alert preferences chosen in onboarding to the server
 * (`/api/preferences/alerts`, keyed by Firebase uid). The scheduled backend
 * jobs (daily digest, high-impact news, >3% price moves) read these to decide
 * which notifications each user actually receives.
 */
@Injectable({ providedIn: 'root' })
export class AlertPrefsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/preferences/alerts';

  /** Pull the server-side prefs (used to hydrate local prefs after login). */
  async fetch(): Promise<AlertPrefs> {
    const response = await firstValueFrom(this.http.get<AlertPrefsResponse>(this.baseUrl));
    const prefs = response.prefs ?? {};
    return {
      priceMoves: typeof prefs.priceMoves === 'boolean' ? prefs.priceMoves : DEFAULT_ALERT_PREFS.priceMoves,
      highImpact: typeof prefs.highImpact === 'boolean' ? prefs.highImpact : DEFAULT_ALERT_PREFS.highImpact,
      dailyDigest: typeof prefs.dailyDigest === 'boolean' ? prefs.dailyDigest : DEFAULT_ALERT_PREFS.dailyDigest,
    };
  }

  /** Persist the given prefs server-side. */
  async sync(prefs: AlertPrefs): Promise<void> {
    await firstValueFrom(this.http.put(this.baseUrl, prefs));
  }
}
