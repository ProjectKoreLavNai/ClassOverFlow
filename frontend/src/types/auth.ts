/**
 * ============================================================================
 * CLASSOVERFLOW — TYPE DEFINITIONS: AUTHENTICATION & ROLE MANAGEMENT
 * Milestone 2.1: User Authentication & Role Management (Frontend)
 * ============================================================================
 */

export type AcademicRole = 'teacher' | 'cr' | 'student' | 'admin';

export interface AcademicUser {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  role: AcademicRole;
  department: string;
  roll?: string;
  phone?: string;
  avatar: string;
  isVerified: boolean;
  isInstitutional: boolean;
  createdAt?: string;
}

export interface FilterResult {
  success: boolean;
  filterName?: string;
  message: string;
}

export interface SecurityRequest {
  email: string;
  password?: string;
  fullName?: string;
  username?: string;
  role?: AcademicRole;
  roll?: string;
  phone?: string;
  isRegistration: boolean;
  isInstitutional?: boolean;
  requiresManualAdminVerification?: boolean;
}

export interface AuthPermissions {
  canAccessAdmin(): boolean;
  canAccessCRDesk(): boolean;
  canAccessAIStudio(): boolean;
  canCreateCourse(): boolean;
  canJoinCourse(): boolean;
  canEditGrades(): boolean;
  canSubmitWork(): boolean;
  canBroadcastAlerts(): boolean;
}

export interface IUserSession extends AuthPermissions {
  id: string;
  name: string;
  email: string;
  role: AcademicRole;
  department: string;
  roll?: string;
  phone?: string;
  avatar: string;
  isVerified: boolean;
  isInstitutional: boolean;
  token: string;
  getRoleLabel(): string;
  getLandingRoute(): string;
}
