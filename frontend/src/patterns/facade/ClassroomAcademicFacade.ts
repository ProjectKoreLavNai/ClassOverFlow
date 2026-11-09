/**
 * Milestone 2.2: Course Management & Announcements
 * Pattern 6: Facade Pattern (Classroom Academic Operations Facade)
 * 
 * Target: Provides a unified, simplified interface over multiple underlying
 * subsystems: Course Registry, Announcement Feed, Observer Event Publisher,
 * Security RBAC Enforcement, and Discord Webhook Streaming.
 * Satisfies the strict ≤3-click usability requirement.
 */

import { CourseBlueprint, type EnrolledStudent } from '../prototype/CoursePrototype';
import { CourseEventPublisher } from '../observer/CourseEventPublisher';
import { SecurityBouncerProxy } from '../proxy/SecurityBouncerProxy';
import type { IUserSession } from '../../types/auth';
import api from '../../services/api';

export interface CourseAnnouncement {
  id: string;
  courseCode: string;
  authorName: string;
  authorEmail?: string;
  authorRole: string;
  authorAvatar: string;
  title: string;
  content: string;
  attachmentTag: string;
  streamedToDiscord: boolean;
  createdAt: string;
  likes: number;
}

export class ClassroomAcademicFacade {
  private static instance: ClassroomAcademicFacade | null = null;
  private publisher: CourseEventPublisher;
  private courses: CourseBlueprint[] = [];
  private announcements: CourseAnnouncement[] = [];
  private syncPromise: Promise<void> | null = null;

  private constructor() {
    this.publisher = CourseEventPublisher.getInstance();
    this.courses = this.loadCoursesFromStorage();
    this.announcements = this.loadAnnouncementsFromStorage();
  }

  public async syncWithBackend(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }
    this.syncPromise = (async () => {
      try {
        const backendCourses = await api.listCourses();
        const courseMembers = await Promise.all(
          backendCourses.map((backendCourse) => api.listCourseMembers(backendCourse.course_id))
        );
        this.courses = backendCourses.map((backendCourse, index) => {
          const members: EnrolledStudent[] = courseMembers[index].map((member) => ({
            id: String(member.student_id),
            name: member.full_name,
            email: member.email,
            avatar: member.full_name.split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase(),
            joinedAt: member.enrolled_at ? new Date(member.enrolled_at).toLocaleDateString() : '',
          }));
          return new CourseBlueprint(
            backendCourse.course_code,
            `${backendCourse.course_code}: ${backendCourse.course_name}`,
            backendCourse.teacher_name || backendCourse.teacher_email || 'Course teacher',
            'Current term',
            backendCourse.class_code || '',
            '#eeeeee',
            backendCourse.students_count ?? 0,
            [],
            { quizzes: 20, assignments: 30, attendance: 10, finalExam: 40 },
            backendCourse.description || '',
            '',
            [],
            backendCourse.created_at || new Date().toISOString(),
            members,
            backendCourse.course_id,
            backendCourse.teacher_email
          );
        });
        this.saveCoursesToStorage(this.courses);
      } finally {
        this.syncPromise = null;
      }
    })();
    return this.syncPromise;
  }

  public static getInstance(): ClassroomAcademicFacade {
    if (!ClassroomAcademicFacade.instance) {
      ClassroomAcademicFacade.instance = new ClassroomAcademicFacade();
    }
    return ClassroomAcademicFacade.instance;
  }

  /**
   * The exact 4 academic courses matching index.html lines 1442–1560
   */
  private loadCoursesFromStorage(): CourseBlueprint[] {
    return [];
  }

  private saveCoursesToStorage(courses: CourseBlueprint[]): void {
    localStorage.setItem('classoverflow_courses_v2_6', JSON.stringify(courses));
    localStorage.setItem('classoverflow_courses_v2_5', JSON.stringify(courses));
    localStorage.setItem('classoverflow_courses_v2_4', JSON.stringify(courses));
  }

  private loadAnnouncementsFromStorage(): CourseAnnouncement[] {
    try {
      const data = localStorage.getItem('classoverflow_announcements_v2_4');
      if (data) return JSON.parse(data);
    } catch {}

    const defaultAnnouncements: CourseAnnouncement[] = [
      {
        id: 'ann-1',
        courseCode: 'CSE-3102',
        authorName: 'Gojo Satoru',
        authorRole: 'Teacher',
        authorAvatar: 'AH',
        title: 'Milestone 2.1 & 2.2 Architectural Guidelines Published',
        content: 'Please study the 4 design patterns implemented in Milestone 2.1 alongside Milestone 2.2 Prototype, Facade, and Observer patterns. Viva review will take place this Thursday.',
        attachmentTag: 'Syllabus & Viva Notice',
        streamedToDiscord: true,
        createdAt: 'Today, 10:15 AM',
        likes: 18
      },
      {
        id: 'ann-2',
        courseCode: 'CSE-3102',
        authorName: 'Daemon Targaryen',
        authorRole: 'CR (Roll 55)',
        authorAvatar: 'NO',
        title: 'Class Schedule Update: Lab Room Shift to Room 402',
        content: 'Due to network maintenance in Lab 2, our Software Engineering Lab session will temporarily shift to Room 402 with full projector support.',
        attachmentTag: 'CR Schedule Coordination',
        streamedToDiscord: true,
        createdAt: 'Yesterday, 3:40 PM',
        likes: 24
      }
    ];
    this.saveAnnouncementsToStorage(defaultAnnouncements);
    return defaultAnnouncements;
  }

  private saveAnnouncementsToStorage(announcements: CourseAnnouncement[]): void {
    localStorage.setItem('classoverflow_announcements_v2_4', JSON.stringify(announcements));
  }

  // ================= FACADE HIGH-LEVEL UNIFIED OPERATIONS =================

  /**
   * Facade Method: Clone Course via Prototype Pattern
   * Duplicates an existing course with all its curriculum units and topics,
   * resets completed checkboxes to 0%, assigns new term/code in <150ms.
   */
  public cloneCourseBlueprint(
    sourceCourseCode: string,
    newCourseTitle: string,
    newTerm: string,
    newCode: string,
    session: IUserSession
  ): { success: boolean; message: string; clonedCourse?: CourseBlueprint } {
    const check = SecurityBouncerProxy.inspectAction('create_course', session);
    if (!check.allowed) {
      return { success: false, message: check.violation?.resource || 'Unauthorized action' };
    }

    const source = this.courses.find((c) => c.code === sourceCourseCode);
    if (!source) {
      return { success: false, message: `Source course ${sourceCourseCode} not found.` };
    }

    // Prototype Pattern invocation
    const cloned = source.cloneForNewCohort(newCourseTitle, newTerm, newCode);
    cloned.instructor = session.name;
    cloned.instructorEmail = session.email;
    this.courses.unshift(cloned);
    this.saveCoursesToStorage(this.courses);

    // Observer notification
    this.publisher.notify({
      id: `evt-clone-${Date.now()}`,
      type: 'COURSE_CLONED',
      courseCode: cloned.code,
      actor: session.name,
      actorRole: session.getRoleLabel(),
      payload: {
        title: cloned.title,
        content: `Cloned full syllabus from ${source.code} with ${cloned.units.reduce((acc, u) => acc + u.topics.length, 0)} curriculum topics.`,
        extra: { sourceCode: sourceCourseCode, newCohortCode: cloned.cohortCode }
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    return {
      success: true,
      message: `Course successfully cloned via Prototype Pattern! New Join Code: ${cloned.cohortCode}`,
      clonedCourse: cloned
    };
  }

  public getCourses(): CourseBlueprint[] {
    return [...this.courses];
  }

  public getCourseByCode(code: string): CourseBlueprint | undefined {
    return this.courses.find((c) => c.code.toLowerCase() === code.toLowerCase());
  }

  public getAnnouncements(courseCode?: string): CourseAnnouncement[] {
    if (!courseCode) return [...this.announcements];
    return this.announcements.filter((a) => a.courseCode.toLowerCase() === courseCode.toLowerCase());
  }

  public likeAnnouncement(id: string): void {
    const item = this.announcements.find((a) => a.id === id);
    if (item) {
      item.likes += 1;
      this.saveAnnouncementsToStorage(this.announcements);
    }
  }

  public toggleTopicCompletion(courseCode: string, topicId: string): void {
    const course = this.getCourseByCode(courseCode);
    if (!course) return;
    for (const unit of course.units) {
      for (const topic of unit.topics) {
        if (topic.id === topicId) {
          topic.isCompleted = !topic.isCompleted;
          this.saveCoursesToStorage(this.courses);
          return;
        }
      }
    }
  }

  public isTeacherCreator(course: CourseBlueprint, session: IUserSession): boolean {
    if (!session) return false;
    if (course.instructorEmail && session.email) {
      if (course.instructorEmail.trim().toLowerCase() === session.email.trim().toLowerCase()) {
        return true;
      }
    }
    return course.instructor.trim().toLowerCase() === session.name.trim().toLowerCase();
  }

  public isStudentEnrolled(courseCode: string, studentEmailOrId?: string): boolean {
    if (!studentEmailOrId) return false;
    const course = this.getCourseByCode(courseCode);
    if (!course || !course.enrolledStudents) return false;
    const query = studentEmailOrId.toLowerCase();
    return course.enrolledStudents.some(
      (s) => s.email.toLowerCase() === query || s.id.toLowerCase() === query
    );
  }

  public getCourseByInvitationId(invitationId: string): CourseBlueprint | undefined {
    const clean = (invitationId || '').trim().toLowerCase();
    if (!clean) return undefined;
    return this.courses.find(
      (c) => c.cohortCode.trim().toLowerCase() === clean || c.code.trim().toLowerCase() === clean
    );
  }
}
