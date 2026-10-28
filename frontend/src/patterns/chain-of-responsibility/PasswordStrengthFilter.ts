import { SecurityFilter } from './SecurityFilter';
import type { FilterResult, SecurityRequest } from '../../types/auth';

export interface PasswordAnalysis {
  score: number;
  strength: 'weak' | 'medium' | 'strong';
  checks: {
    length: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

/**
 * Filter 3: Password Strength & Entropy Filter
 * Enforces length >= 8, uppercase, lowercase, numbers, and symbols.
 */
export class PasswordStrengthFilter extends SecurityFilter {
  public static evaluate(password: string): PasswordAnalysis {
    const checks = {
      length: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password)
    };

    let score = 0;
    if (checks.length) score += 1;
    if (checks.hasUpper && checks.hasLower) score += 1;
    if (checks.hasNumber) score += 1;
    if (checks.hasSpecial) score += 1;

    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 2) strength = 'medium';

    return { score, strength, checks };
  }

  public override handle(request: SecurityRequest): FilterResult {
    if (request.isRegistration) {
      const pwd = request.password || '';
      const analysis = PasswordStrengthFilter.evaluate(pwd);

      if (pwd.length < 8) {
        return {
          success: false,
          filterName: 'PasswordStrengthFilter',
          message: 'Security Gate 3: Password must be at least 8 characters long.'
        };
      }

      if (analysis.strength === 'weak') {
        return {
          success: false,
          filterName: 'PasswordStrengthFilter',
          message: 'Security Gate 3: Password entropy too weak. Include uppercase letters, numbers, and symbols.'
        };
      }
    }

    return super.handle(request);
  }
}
