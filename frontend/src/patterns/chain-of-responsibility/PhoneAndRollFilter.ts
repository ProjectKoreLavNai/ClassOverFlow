import { SecurityFilter } from './SecurityFilter';
import type { FilterResult, SecurityRequest } from '../../types/auth';

/**
 * Filter 4: Academic Cohort & Contact Data Gate
 * Validates phone format and required academic profile attributes.
 */
export class PhoneAndRollFilter extends SecurityFilter {
  public override handle(request: SecurityRequest): FilterResult {
    if (request.isRegistration) {
      if (!request.fullName || request.fullName.trim().length < 3) {
        return {
          success: false,
          filterName: 'PhoneAndRollFilter',
          message: 'Security Gate 4: Please enter your full official academic name.'
        };
      }

      const phone = (request.phone || '').trim();
      if (phone && !/^\+?[0-9\s\-]{8,16}$/.test(phone)) {
        return {
          success: false,
          filterName: 'PhoneAndRollFilter',
          message: 'Security Gate 4: Invalid telephone format. Please use a valid contact number.'
        };
      }
    }

    return super.handle(request);
  }
}
