import { Injectable, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Logs the user out after 10 minutes with no pointer, keyboard, or scroll activity.
 * JWT expiry stays a longer hard cap; this is the idle timer.
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private watching = false;
  private lastTouch = 0;
  private readonly onActivity = () => this.touch();
  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') {
      this.auth.expireIfIdle();
    }
  };

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.startWatching();
      } else {
        this.stopWatching();
      }
    });
  }

  private startWatching(): void {
    if (this.watching || typeof window === 'undefined') return;
    this.watching = true;
    this.auth.expireIfIdle();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, this.onActivity, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    this.timer = setInterval(() => this.auth.expireIfIdle(), 15_000);
  }

  private stopWatching(): void {
    if (!this.watching) return;
    this.watching = false;
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, this.onActivity, true);
    }
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private touch(): void {
    const now = Date.now();
    if (now - this.lastTouch < 1000) return;
    this.lastTouch = now;
    this.auth.touchActivity();
  }
}
