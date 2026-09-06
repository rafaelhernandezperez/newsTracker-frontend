import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PushService } from './core/services/push.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly push = inject(PushService);
  private refreshedPushUid: string | null = null;

  constructor() {
    // Refresh rotating FCM tokens once per signed-in session without prompting.
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
