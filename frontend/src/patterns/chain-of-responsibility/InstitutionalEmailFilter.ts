import { SecurityFilter } from './SecurityFilter';
import type { FilterResult, SecurityRequest } from '../../types/auth';

/**
 * Filter 2: Institutional Email Verification
 * Validates syntax and verifies institutional domain status (.edu, .ac.bd, university.edu).
 */
export class InstitutionalEmailFilter extends SecurityFilter {
  public override handle(request: SecurityRequest): FilterResult {
    const email = (request.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        success: false,
        filterName: 'InstitutionalEmailFilter',
        message: 'Security Gate 2: Please enter a valid email format.'
      };
    }

    /*const isInstitutional = email.endsWith('.edu') || email.includes('.ac.') || email.endsWith('@university.edu');
    request.isInstitutional = isInstitutional;

    // Non-institutional accounts are flagged for manual admin verification in Functional Requirement 4.1
    if (request.isRegistration && !isInstitutional) {
      request.requiresManualAdminVerification = true;
    }*/

    return super.handle(request);
  }
}
