import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PushService } from './core/services/push.service';
import { AppLanguage, LanguageService } from './core/services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly push = inject(PushService);
  readonly languageService = inject(LanguageService);
  private pushRefreshed = false;

  setLanguage(language: AppLanguage): void {
    if (language === this.languageService.language()) {
      return;
    }

    this.languageService.setLanguage(language);
    window.location.reload();
  }

  constructor() {
    // Returning session: re-register the FCM device token once auth resolves.
    // enable() only runs at login/onboarding, but tokens rotate — without this
    // refresh, pushes to a long-lived session would silently stop arriving.
    // No permission prompt: refreshIfGranted() is a no-op unless the user
    // already granted notifications.
    effect(() => {
      if (this.auth.ready() && this.auth.user() && !this.pushRefreshed) {
        this.pushRefreshed = true;
        void this.push.refreshIfGranted();
      }
    });
  }
}
