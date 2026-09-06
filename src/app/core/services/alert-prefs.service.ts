import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertPrefs, DEFAULT_ALERT_PREFS } from './user-preferences.service';

type AlertPrefsResponse = {
  ok: boolean;
  prefs?: Partial<AlertPrefs>;
};

@Injectable({ providedIn: 'root' })
export class AlertPrefsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/preferences/alerts';

  async fetch(): Promise<AlertPrefs> {
    const response = await firstValueFrom(this.http.get<AlertPrefsResponse>(this.baseUrl));
    const prefs = response.prefs ?? {};
    return {
      priceMoves:
        typeof prefs.priceMoves === 'boolean' ? prefs.priceMoves : DEFAULT_ALERT_PREFS.priceMoves,
      highImpact:
        typeof prefs.highImpact === 'boolean' ? prefs.highImpact : DEFAULT_ALERT_PREFS.highImpact,
      dailyDigest:
        typeof prefs.dailyDigest === 'boolean'
          ? prefs.dailyDigest
          : DEFAULT_ALERT_PREFS.dailyDigest,
    };
  }

  async sync(prefs: AlertPrefs): Promise<void> {
    await firstValueFrom(this.http.put(this.baseUrl, prefs));
  }
}
