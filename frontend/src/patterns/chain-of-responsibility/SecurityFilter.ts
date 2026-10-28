import type { FilterResult, SecurityRequest } from '../../types/auth';

/**
 * Base Abstract Handler for Chain of Responsibility Pattern
 * Behavioral Pattern: Passes the security validation request down the chain
 * until one fails or all gates pass.
 */
export abstract class SecurityFilter {
  protected nextFilter: SecurityFilter | null = null;

  public setNext(filter: SecurityFilter): SecurityFilter {
    this.nextFilter = filter;
    return filter;
  }

  public handle(request: SecurityRequest): FilterResult {
    if (this.nextFilter) {
      return this.nextFilter.handle(request);
    }
    return {
      success: true,
      message: 'All security verification gates successfully cleared.'
    };
  }
}
