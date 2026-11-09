import type { IUserSession } from '../../types/auth';

export interface SecurityViolation {
  resource: string;
  requiredRole: string;
  currentRole: string;
}

export interface SecurityCheckResult {
  allowed: boolean;
  violation?: SecurityViolation;
}

/** Sidebar tabs that make up the admin console: account handling and course handling. */
const ADMIN_TABS = ['admin-accounts', 'admin-courses'];

/**
 * Proxy Pattern: Security Bouncer / RBAC Enforcement
 * Structural Pattern: Sits directly in front of view routing and academic action dispatchers.
 * Intercepts requests, inspects session claims, and blocks unauthorized interactions before
 * they reach target components.
 */
export class SecurityBouncerProxy {
  public static inspectNavigation(
    targetTab: string,
    session: IUserSession | null
  ): SecurityCheckResult {
    if (!session) {
      return {
        allowed: false,
        violation: {
          resource: 'Protected Academic Workspace',
          requiredRole: 'Authenticated Academic Persona',
          currentRole: 'Guest / Unauthenticated'
        }
      };
    }

    const isAdminTab = ADMIN_TABS.includes(targetTab);

    // Role-Based Access Control Rules
    // Platform Administrator can ONLY access administrative pages
    if (session.role === 'admin' && !isAdminTab) {
      return {
        allowed: false,
        violation: {
          resource: 'Academic Classroom & Course Portals',
          requiredRole: 'Academic Faculty or Enrolled Student (Administrators restricted to Admin Console)',
          currentRole: session.getRoleLabel()
        }
      };
    }

    if (isAdminTab && !session.canAccessAdmin()) {
      return {
        allowed: false,
        violation: {
          resource: 'Institutional Administrative Console',
          requiredRole: 'Platform Administrator & Registrar',
          currentRole: session.getRoleLabel()
        }
      };
    }

    if (targetTab === 'crdesk' && !session.canAccessCRDesk()) {
      return {
        allowed: false,
        violation: {
          resource: 'Class Representative (CR) Operations Desk',
          requiredRole: 'Class Representative (CR Privilege)',
          currentRole: session.getRoleLabel()
        }
      };
    }

    if (targetTab === 'aistudio' && !session.canAccessAIStudio()) {
      return {
        allowed: false,
        violation: {
          resource: 'AI Academic Pedagogical Studio',
          requiredRole: 'Professor / Course Chair Privileges',
          currentRole: session.getRoleLabel()
        }
      };
    }

    return { allowed: true };
  }

  public static inspectAction(
    actionType: string,
    session: IUserSession | null
  ): SecurityCheckResult {
    if (!session) {
      return {
        allowed: false,
        violation: {
          resource: 'Academic Action Execution',
          requiredRole: 'Authenticated Session',
          currentRole: 'Guest / Unauthenticated'
        }
      };
    }

    if (actionType === 'create_course' && !session.canCreateCourse()) {
      return {
        allowed: false,
        violation: {
          resource: 'Course Creation & Inception',
          requiredRole: 'Faculty / Course Chair Authority',
          currentRole: session.getRoleLabel()
        }
      };
    }

    if (actionType === 'join_course' && !session.canJoinCourse()) {
      return {
        allowed: false,
        violation: {
          resource: 'Academic Course Enrollment',
          requiredRole: 'Enrolled Student or Scholar Authority',
          currentRole: session.getRoleLabel()
        }
      };
    }

    if ((actionType === 'draft_lecture_plan' || actionType === 'generate_quiz') && !session.canCreateCourse()) {
      return {
        allowed: false,
        violation: {
          resource: 'Faculty AI Studio (Lecture Plan & Formative Quiz Generator)',
          requiredRole: 'Course Teacher Authority',
          currentRole: session.getRoleLabel()
        }
      };
    }

    if (actionType === 'edit_grades' && !session.canEditGrades()) {
      return {
        allowed: false,
        violation: {
          resource: 'Transactional Gradebook Modification',
          requiredRole: 'Course Instructor Privileges',
          currentRole: session.getRoleLabel()
        }
      };
    }

    if (actionType === 'broadcast_deadline' && !session.canBroadcastAlerts()) {
      return {
        allowed: false,
        violation: {
          resource: 'Multi-Channel Urgent Broadcast Dispatch',
          requiredRole: 'CR or Course Instructor Authority',
          currentRole: session.getRoleLabel()
        }
      };
    }

    return { allowed: true };
  }
}
