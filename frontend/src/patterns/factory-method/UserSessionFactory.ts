import type { AcademicUser, IUserSession } from '../../types/auth';
import {
  AdminSession,
  CRSession,
  StudentSession,
  TeacherSession
} from './UserSession';

/**
 * Factory Method Pattern: UserSessionFactory
 * Dynamically instantiates the authorized session subclass according to the user's role.
 * Eliminates sprawling switch/case and if/else conditionals in UI components.
 */
export class UserSessionFactory {
  public static createSession(userData: AcademicUser): IUserSession {
    const role = (userData.role || 'student').toLowerCase();

    switch (role) {
      case 'teacher':
      case 'professor':
      case 'instructor':
        return new TeacherSession(userData);

      case 'cr':
      case 'representative':
      case 'class_representative':
        return new CRSession(userData);

      case 'admin':
      case 'administrator':
      case 'registrar':
        return new AdminSession(userData);

      case 'student':
      default:
        return new StudentSession(userData);
    }
  }
}
