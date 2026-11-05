/**
 * ClassOverFlow Backend API Client
 * Connects the React frontend to the FastAPI backend service
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface ApiResponse<T> {
  data: T;
  error?: string | any[];
}

export interface BackendUser {
  user_id?: number;
  email: string;
  role: string;
  username: string;
  full_name?: string;
  phone?: string | null;
  is_verified?: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: BackendUser;
}

export interface BackendCourse {
  course_id: number;
  course_name: string;
  course_code: string;
  description: string;
  syllabus: string;
  class_code?: string;
  teacher_email?: string;
  teacher_name?: string;
  teacher_id?: number;
  created_at?: string;
  students_count?: number;
}

export interface BackendMark {
  mark_id: number;
  student_id: number;
  assessment_name: string;
  marks_obtained: number;
  total_marks: number;
  recorded_at: string;
}

export interface BackendGradebook {
  course_id: number;
  classes_held: number;
  average_attendance: number | null;
  below_minimum: Array<{
    student_id: number;
    full_name: string;
    attendance_percent: number;
  }>;
  students: Array<{
    student_id: number;
    full_name: string;
    username: string;
    attended: number;
    attendance_percent: number | null;
    marks: BackendMark[];
  }>;
  sessions: Array<{
    session_id: number;
    session_date: string;
    records: Array<{ student_id: number; status: 'PRESENT' | 'ABSENT' }>;
  }>;
}

export interface BackendAssignment {
  assignment_id: number;
  title: string;
  deadline: string | null;
  total_marks: number;
}

export interface BackendCourseMember {
  student_id: number;
  full_name: string;
  username: string;
  email: string;
  enrolled_at: string | null;
}

export interface BackendAnnouncement {
  announcement_id: number;
  course_id: number;
  title: string;
  content: string;
  author_email?: string;
  created_at?: string;
}

export interface BackendComment {
  comment_id: number;
  announcement_id: number;
  user_id: number;
  comment_text: string;
  author_name: string;
  author_email?: string;
  author_role: string;
  created_at?: string;
}

export class ApiError extends Error {
  public status: number;
  public details: any;
  /** Seconds the server asked us to wait (HTTP 429 Retry-After), when it sent one. */
  public retryAfter: number | null;

  constructor(message: string, status: number, details?: any, retryAfter: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

/** True when the server refused the request because of its rate limit. */
export const isRateLimited = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status === 429;

const parseRetryAfter = (value: string | null): number | null => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(1, Math.ceil((date - Date.now()) / 1000));
};

/*
 * Token storage (security gap: "Safe browser session and credential storage").
 * Tokens are held in memory and mirrored to sessionStorage only, so they are
 * never written to localStorage and disappear when the tab is closed.
 * Stopgap until the backend issues Secure, HttpOnly, SameSite cookies.
 */
const ACCESS_KEY = 'classoverflow_access_token';
const REFRESH_KEY = 'classoverflow_refresh_token';
const LEGACY_LOCAL_KEYS = [
  ACCESS_KEY,
  REFRESH_KEY,
  'classoverflow_users_v6',
  'classoverflow_active_session_v5',
];

const readSession = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSession = (key: string, value: string | null) => {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Storage disabled: the in-memory copy still works for this tab.
  }
};

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Wipe credentials that older builds left in localStorage.
    try {
      LEGACY_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // ignore
    }
    this.token = readSession(ACCESS_KEY);
    this.refreshToken = readSession(REFRESH_KEY);
  }

  public setTokens(accessToken: string | null, refreshToken: string | null = null) {
    this.token = accessToken;
    writeSession(ACCESS_KEY, accessToken);

    if (refreshToken) {
      this.refreshToken = refreshToken;
      writeSession(REFRESH_KEY, refreshToken);
    } else if (refreshToken === null && accessToken === null) {
      this.refreshToken = null;
      writeSession(REFRESH_KEY, null);
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const currentToken = this.getToken();
    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
          throw new ApiError(
            retryAfter
              ? `Too many attempts. Try again in ${retryAfter}s.`
              : 'Too many attempts. Wait a moment and try again.',
            429,
            data,
            retryAfter
          );
        }
        const detail = Array.isArray(data.detail)
          ? data.detail.map((e: any) => e.msg).join(', ')
          : data.detail;
        const errorMessage =
          detail ||
          (Array.isArray(data.error) ? data.error.map((e: any) => e.msg).join(', ') : data.error) ||
          response.statusText ||
          'API Request Failed';
        throw new ApiError(errorMessage, response.status, data);
      }

      return data as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(err.message || 'Network connection to backend failed', 0, err);
    }
  }

  // --- Health Checks ---
  public async checkHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health/live');
  }

  // --- Authentication ---
  public async login(payload: { email: string; password: string }): Promise<AuthTokenResponse> {
    const res = await this.request<{ data: AuthTokenResponse }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
      }),
    });
    this.setTokens(res.data.access_token, res.data.refresh_token);
    return res.data;
  }

  public async register(payload: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role: string;
    username?: string;
  }): Promise<BackendUser> {
    const username =
      payload.username ||
      payload.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') ||
      `user_${Date.now()}`;
    const res = await this.request<{ data: BackendUser }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: payload.fullName,
        username: username.length < 3 ? `${username}_usr` : username,
        email: payload.email,
        password: payload.password,
        role: payload.role.toLowerCase(),
        phone: payload.phone || null,
      }),
    });
    return res.data;
  }

  public async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    try {
      if (refreshToken && this.token) {
        await this.request('/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (e) {
      console.warn('Backend logout encountered error, clearing tokens locally:', e);
    } finally {
      this.setTokens(null, null);
    }
  }

  public async getProfile(): Promise<BackendUser> {
    const res = await this.request<{ data: BackendUser }>('/api/v1/auth/me');
    return res.data;
  }

  public async verifyResetEmail(email: string): Promise<{ email: string; full_name: string; role: string; exists: boolean }> {
    const res = await this.request<{ data: { email: string; full_name: string; role: string; exists: boolean } }>(
      '/api/v1/auth/forgot-password/verify',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }
    );
    return res.data;
  }

  public async resetPassword(payload: {
    email: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ email: string; message: string }> {
    const res = await this.request<{ data: { email: string; message: string } }>(
      '/api/v1/auth/forgot-password/reset',
      {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email.trim().toLowerCase(),
          new_password: payload.new_password,
          confirm_password: payload.confirm_password,
        }),
      }
    );
    return res.data;
  }

  public async updateProfile(payload: Partial<BackendUser>): Promise<BackendUser> {
    const res = await this.request<{ data: BackendUser }>('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async listUsers(role?: string, search?: string, offset = 0): Promise<BackendUser[]> {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    params.set('limit', '100');
    params.set('offset', String(offset));
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ data: BackendUser[] }>(`/api/v1/users${query}`);
    return res.data;
  }

  public async listAllAdminUsers(): Promise<BackendUser[]> {
    const users: BackendUser[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await this.listUsers(undefined, undefined, offset);
      users.push(...page);
      if (page.length < 100) return users;
    }
  }

  public async updateAdminUser(
    userId: number,
    payload: { role?: string; is_verified?: boolean }
  ): Promise<BackendUser> {
    const res = await this.request<{ data: BackendUser }>(`/api/v1/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async deleteAdminUser(userId: number): Promise<void> {
    await this.request(`/api/v1/users/${userId}`, { method: 'DELETE' });
  }

  // --- Courses ---
  public async listCourses(): Promise<BackendCourse[]> {
    const res = await this.request<{ data: BackendCourse[] }>('/api/v1/courses');
    return res.data;
  }

  public async getCourse(courseId: number): Promise<BackendCourse> {
    const res = await this.request<{ data: BackendCourse }>(`/api/v1/courses/${courseId}`);
    return res.data;
  }

  public async generateCourseClassCode(courseId: number): Promise<{ class_code: string }> {
    const res = await this.request<{ data: { class_code: string } }>(
      `/api/v1/courses/${courseId}/class-code`,
      { method: 'POST' }
    );
    return res.data;
  }

  public async createCourse(payload: {
    course_name: string;
    course_code: string;
    description: string;
    syllabus: string;
    teacher_id?: number;
  }): Promise<BackendCourse> {
    const res = await this.request<{ data: BackendCourse }>('/api/v1/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async updateCourse(courseId: number, payload: Partial<BackendCourse>): Promise<BackendCourse> {
    const res = await this.request<{ data: BackendCourse }>(`/api/v1/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async deleteCourse(courseId: number): Promise<void> {
    await this.request(`/api/v1/courses/${courseId}`, {
      method: 'DELETE',
    });
  }

  public async listCourseUpcoming(courseId: number): Promise<BackendAssignment[]> {
    const res = await this.request<{ data: BackendAssignment[] }>(
      `/api/v1/courses/${courseId}/upcoming`
    );
    return res.data;
  }

  public async joinCourse(classCode: string): Promise<{ course_id: number; role: string }> {
    const res = await this.request<{ data: { course_id: number; role: string } }>('/api/v1/courses/join', {
      method: 'POST',
      body: JSON.stringify({ class_code: classCode }),
    });
    return res.data;
  }

  public async listCourseMembers(courseId: number): Promise<BackendCourseMember[]> {
    const res = await this.request<{ data: BackendCourseMember[] }>(`/api/v1/courses/${courseId}/members`);
    return res.data;
  }

  public async getGradebook(courseId: number): Promise<BackendGradebook> {
    const res = await this.request<{ data: BackendGradebook }>(`/api/v1/courses/${courseId}/gradebook`);
    return res.data;
  }

  public async saveAttendance(
    courseId: number,
    payload: {
      session_date: string;
      records: Array<{ student_id: number; status: 'PRESENT' | 'ABSENT' }>;
    }
  ): Promise<{ session_id: number }> {
    const res = await this.request<{ data: { session_id: number } }>(
      `/api/v1/courses/${courseId}/attendance`,
      { method: 'PUT', body: JSON.stringify(payload) }
    );
    return res.data;
  }

  public async saveGradebook(
    courseId: number,
    payload: {
      session_date: string;
      attendance: Array<{ student_id: number; status: 'PRESENT' | 'ABSENT' }>;
      marks: Array<{
        mark_id?: number;
        student_id: number;
        assessment_name: string;
        marks_obtained: number;
        total_marks: number;
      }>;
      delete_mark_ids: number[];
    }
  ): Promise<{ attendance: { session_id: number }; marks_saved: number; marks_deleted: number }> {
    const res = await this.request<{
      data: { attendance: { session_id: number }; marks_saved: number; marks_deleted: number };
    }>(`/api/v1/courses/${courseId}/gradebook`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async createMark(
    courseId: number,
    payload: { student_id: number; assessment_name: string; marks_obtained: number; total_marks: number }
  ): Promise<{ mark: BackendMark }> {
    const res = await this.request<{ data: { mark: BackendMark } }>(
      `/api/v1/courses/${courseId}/marks`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return res.data;
  }

  public async updateMark(
    courseId: number,
    markId: number,
    payload: { marks_obtained: number; total_marks: number }
  ): Promise<{ mark: BackendMark }> {
    const res = await this.request<{ data: { mark: BackendMark } }>(
      `/api/v1/courses/${courseId}/marks/${markId}`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    );
    return res.data;
  }

  public async deleteMark(courseId: number, markId: number): Promise<{ deleted: boolean }> {
    const res = await this.request<{ data: { deleted: boolean } }>(
      `/api/v1/courses/${courseId}/marks/${markId}`,
      { method: 'DELETE' }
    );
    return res.data;
  }

  public async getMarksDistribution(
    courseId: number
  ): Promise<Array<{ name: string; total_marks: number }>> {
    const res = await this.request<{ data: Array<{ name: string; total_marks: number }> }>(
      `/api/v1/courses/${courseId}/marks-distribution`
    );
    return res.data;
  }

  public async saveMarksDistribution(
    courseId: number,
    items: Array<{ name: string; total_marks: number }>
  ): Promise<Array<{ name: string; total_marks: number }>> {
    const res = await this.request<{ data: Array<{ name: string; total_marks: number }> }>(
      `/api/v1/courses/${courseId}/marks-distribution`,
      {
        method: 'PUT',
        body: JSON.stringify({ items }),
      }
    );
    return res.data;
  }


  // --- Announcements ---
  public async listAnnouncements(courseId: number): Promise<BackendAnnouncement[]> {
    const res = await this.request<{ data: BackendAnnouncement[] }>(`/api/v1/courses/${courseId}/announcements`);
    return res.data;
  }

  public async createAnnouncement(
    courseId: number,
    payload: { title: string; content: string }
  ): Promise<BackendAnnouncement> {
    const res = await this.request<{ data: BackendAnnouncement }>(`/api/v1/courses/${courseId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async updateAnnouncement(
    announcementId: number,
    payload: { title: string; content: string }
  ): Promise<BackendAnnouncement> {
    const res = await this.request<{ data: BackendAnnouncement }>(`/api/v1/announcements/${announcementId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async deleteAnnouncement(announcementId: number): Promise<void> {
    await this.request(`/api/v1/announcements/${announcementId}`, {
      method: 'DELETE',
    });
  }

  // --- Comments ---
  public async listComments(announcementId: number): Promise<BackendComment[]> {
    const res = await this.request<{ data: BackendComment[] }>(`/api/v1/announcements/${announcementId}/comments`);
    return res.data;
  }

  public async createComment(announcementId: number, commentText: string): Promise<BackendComment> {
    const res = await this.request<{ data: BackendComment }>(`/api/v1/announcements/${announcementId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment_text: commentText }),
    });
    return res.data;
  }

  public async updateComment(
    announcementId: number,
    commentId: number,
    commentText: string
  ): Promise<BackendComment> {
    const res = await this.request<{ data: BackendComment }>(
      `/api/v1/announcements/${announcementId}/comments/${commentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ comment_text: commentText }),
      }
    );
    return res.data;
  }

  public async deleteComment(announcementId: number, commentId: number): Promise<void> {
    await this.request(`/api/v1/announcements/${announcementId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
export default api;
