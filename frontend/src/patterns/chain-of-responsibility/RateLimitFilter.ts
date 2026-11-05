import { SecurityFilter } from './SecurityFilter';
import type { FilterResult, SecurityRequest } from '../../types/auth';

/**
 * Filter 1: Rate Limiting & Brute-Force Gate
 * Usability guard only: it slows down repeated typos in this tab. It is NOT a
 * security control, because anyone can bypass it by calling the API directly.
 * The real limit is enforced by the backend (HTTP 429).
 */
export class RateLimitFilter extends SecurityFilter {
  private failedAttempts: Record<string, { count: number; lockedUntil: number }> = {};

  public recordFailure(email: string): void {
    const key = email.toLowerCase().trim();
    const now = Date.now();
    if (!this.failedAttempts[key]) {
      this.failedAttempts[key] = { count: 1, lockedUntil: 0 };
    } else {
      this.failedAttempts[key].count += 1;
      if (this.failedAttempts[key].count >= 3) {
        // Lock for 20 seconds after 3 consecutive failures
        this.failedAttempts[key].lockedUntil = now + 20000;
      }
    }
  }

  public resetAttempts(email: string): void {
    const key = email.toLowerCase().trim();
    delete this.failedAttempts[key];
  }

  public override handle(request: SecurityRequest): FilterResult {
    const key = (request.email || '').toLowerCase().trim();
    const record = this.failedAttempts[key];
    const now = Date.now();

    if (record && record.lockedUntil > now) {
      const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return {
        success: false,
        filterName: 'RateLimitFilter',
        message: `Too many failed attempts. Try again in ${waitSeconds}s.`,
        retryAfter: waitSeconds
      };
    }

    return super.handle(request);
  }
}
