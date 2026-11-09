import type { AcademicRole, AcademicUser, IUserSession } from '../../types/auth';

/**
 * Base Abstract UserSession
 * Creational Pattern: Subclasses define persona-specific permissions and routes.
 */
export abstract class UserSession implements IUserSession {
  public readonly id: string;
  public readonly name: string;
  public readonly username?: string;
  public readonly email: string;
  public readonly role: AcademicRole;
  public readonly department: string;
  public readonly roll?: string;
  public readonly phone?: string;
  public readonly avatar: string;
  public readonly isVerified: boolean;
  public readonly isInstitutional: boolean;
  public readonly token: string;

  constructor(data: AcademicUser) {
    this.id = data.id || 'usr_' + Date.now();
    this.name = data.fullName;
    this.username = data.username;
    this.email = data.email;
    this.role = data.role;
    this.department = data.department || 'Computer Science & Engineering';
    this.roll = data.roll;
    this.phone = data.phone;
    this.avatar = data.avatar || this.generateInitials(data.fullName);
    this.isVerified = data.isVerified;
    this.isInstitutional = data.isInstitutional;
    this.token = data.token || '';
  }

  private generateInitials(name: string): string {
    const parts = (name || 'Academic User').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name || 'AU').substring(0, 2).toUpperCase();
  }

  public abstract getRoleLabel(): string;
  public abstract getLandingRoute(): string;

  public abstract canAccessAdmin(): boolean;
  public abstract canAccessCRDesk(): boolean;
  public abstract canAccessAIStudio(): boolean;
  public abstract canCreateCourse(): boolean;
  public abstract canJoinCourse(): boolean;
  public abstract canEditGrades(): boolean;
  public abstract canSubmitWork(): boolean;
  public abstract canBroadcastAlerts(): boolean;
}

/**
 * Teacher Persona Session
 */
export class TeacherSession extends UserSession {
  public override getRoleLabel(): string {
    return 'Professor & Course Chair';
  }
  public override getLandingRoute(): string {
    return 'classrooms';
  }

  public override canAccessAdmin(): boolean { return false; }
  public override canAccessCRDesk(): boolean { return false; }
  public override canAccessAIStudio(): boolean { return true; }
  public override canCreateCourse(): boolean { return true; }
  public override canJoinCourse(): boolean { return true; }
  public override canEditGrades(): boolean { return true; }
  public override canSubmitWork(): boolean { return false; }
  public override canBroadcastAlerts(): boolean { return true; }
}

/**
 * Class Representative (CR) Persona Session
 */
export class CRSession extends UserSession {
  public override getRoleLabel(): string {
    return 'Class Representative (CR)';
  }
  public override getLandingRoute(): string {
    return 'crdesk';
  }

  public override canAccessAdmin(): boolean { return false; }
  public override canAccessCRDesk(): boolean { return true; }
  public override canAccessAIStudio(): boolean { return true; }
  public override canCreateCourse(): boolean { return false; }
  public override canJoinCourse(): boolean { return true; }
  public override canEditGrades(): boolean { return false; }
  public override canSubmitWork(): boolean { return true; }
  public override canBroadcastAlerts(): boolean { return true; }
}

/**
 * Student Persona Session
 */
export class StudentSession extends UserSession {
  public override getRoleLabel(): string {
    return 'Student (Learner)';
  }
  public override getLandingRoute(): string {
    return 'todo';
  }

  public override canAccessAdmin(): boolean { return false; }
  public override canAccessCRDesk(): boolean { return false; }
  public override canAccessAIStudio(): boolean { return true; }
  public override canCreateCourse(): boolean { return false; }
  public override canJoinCourse(): boolean { return true; }
  public override canEditGrades(): boolean { return false; }
  public override canSubmitWork(): boolean { return true; }
  public override canBroadcastAlerts(): boolean { return false; }
}

/**
 * Administrator Persona Session
 */
export class AdminSession extends UserSession {
  public override getRoleLabel(): string {
    return 'Platform Administrator & Registrar';
  }
  public override getLandingRoute(): string {
    return 'admin-accounts';
  }

  // Administrator privileges restricted exclusively to institutional admin pages
  public override canAccessAdmin(): boolean { return true; }
  public override canAccessCRDesk(): boolean { return false; }
  public override canAccessAIStudio(): boolean { return false; }
  public override canCreateCourse(): boolean { return false; }
  public override canJoinCourse(): boolean { return false; }
  public override canEditGrades(): boolean { return false; }
  public override canSubmitWork(): boolean { return false; }
  public override canBroadcastAlerts(): boolean { return false; }
}
