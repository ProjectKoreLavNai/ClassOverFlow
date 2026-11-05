import type { AcademicRole } from '../types/auth';

/**
 * Seeded test accounts for local development.
 *
 * Everything here sits behind `import.meta.env.DEV`, which Vite replaces with
 * `false` in `vite build`, so production bundles contain no demo emails and no
 * shared password. These accounts must exist in the backend database; nothing
 * is checked or stored in the browser.
 */
export interface DemoAccount {
  role: AcademicRole;
  name: string;
  email: string;
  tag: string;
}

export const DEMO_ENABLED: boolean = import.meta.env.DEV;

export const DEMO_ACCOUNTS: DemoAccount[] = import.meta.env.DEV
  ? [
      { role: 'teacher', name: 'Gojo Satoru', email: 'gojo.teacher@university.edu', tag: 'Teacher' },
      { role: 'cr', name: 'Daemon Targaryen', email: 'daemon.cr@university.edu', tag: 'Class representative' },
      { role: 'student', name: 'Kiyotaka Ayanokoji', email: 'ayanokoji.student@university.edu', tag: 'Student' },
      { role: 'admin', name: 'Aizen Sosuke', email: 'aizen.admin@university.edu', tag: 'Admin' },
    ]
  : [];

/** Shared password of the seeded accounts. Empty in production builds. */
export const DEMO_PASSWORD: string = import.meta.env.DEV ? 'Password@123' : '';
