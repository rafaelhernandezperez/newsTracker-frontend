import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PushService } from './core/services/push.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly push = inject(PushService);
  private refreshedPushUid: string | null = null;

  constructor() {
    // Returning session: re-register the FCM device token once auth resolves.
    // enable() only runs at login/onboarding, but tokens rotate — without this
    // refresh, pushes to a long-lived session would silently stop arriving.
    // No permission prompt: refreshIfGranted() is a no-op unless the user
    // already granted notifications.
    effect(() => {
      const uid = this.auth.user()?.uid ?? null;
      if (!uid) {
        this.refreshedPushUid = null;
        return;
      }
      if (this.auth.ready() && this.refreshedPushUid !== uid) {
        this.refreshedPushUid = uid;
        void this.push.refreshIfGranted();
      }
    });
  }
}
