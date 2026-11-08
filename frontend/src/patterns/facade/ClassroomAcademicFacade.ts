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
import { CourseEventPublisher, type AcademicEvent } from '../observer/CourseEventPublisher';
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
   * Facade Method 1: Publish Announcement
   * Behind a single call, coordinates:
   * 1. Persistence to course feed
   * 2. Publishing AcademicEvent to Observer Pattern bus
   * 3. In-App subscriber notification
   * 4. Discord Webhook embed dispatch
   * 5. Security audit ledger logging
   */
  public publishAnnouncement(
    courseCode: string,
    title: string,
    content: string,
    session: IUserSession,
    streamToDiscord: boolean = true,
    attachmentTag: string = 'General Academic'
  ): { success: boolean; message: string; announcement?: CourseAnnouncement } {
    if (!title.trim() || !content.trim()) {
      return { success: false, message: 'Announcement title and content cannot be empty.' };
    }

    if (!this.canUserPostAnnouncement(courseCode, session)) {
      return {
        success: false,
        message: session.role === 'student'
          ? 'Students do not have authority to post announcements. Only Teachers and Class Representatives (CR) can post.'
          : 'You do not have authority to post announcements in this course.'
      };
    }

    const newAnnouncement: CourseAnnouncement = {
      id: `ann-${Date.now()}`,
      courseCode,
      authorName: session.name,
      authorRole: session.getRoleLabel(),
      authorAvatar: session.avatar,
      title: title.trim(),
      content: content.trim(),
      attachmentTag,
      streamedToDiscord: streamToDiscord,
      createdAt: 'Just now',
      likes: 0
    };

    this.announcements.unshift(newAnnouncement);
    this.saveAnnouncementsToStorage(this.announcements);

    // Sync to Backend API
    (async () => {
      try {
        const course = this.getCourseByCode(courseCode);
        const courseId = course ? (this.courses.indexOf(course) + 1) : 1;
        await api.createAnnouncement(courseId, {
          title: title.trim(),
          content: content.trim()
        });
      } catch (e) {
        console.warn('Backend announcement sync notification:', e);
      }
    })();

    // Notify Observer Pattern Bus
    const event: AcademicEvent = {
      id: `evt-${Date.now()}`,
      type: 'ANNOUNCEMENT_POSTED',
      courseCode,
      actor: session.name,
      actorRole: session.getRoleLabel(),
      payload: {
        title,
        content,
        streamToDiscord,
        attachmentTag
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.publisher.notify(event);

    return {
      success: true,
      message: streamToDiscord
        ? `Announcement posted & streamed to Discord #${courseCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-announcements!`
        : 'Announcement published to course stream.',
      announcement: newAnnouncement
    };
  }

  /**
   * Facade Method 2: Clone Course via Prototype Pattern
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

  /**
   * Facade Method 3: Create Fresh Course
   */
  public createCourse(
    code: string,
    title: string,
    term: string,
    session: IUserSession
  ): { success: boolean; message: string; course?: CourseBlueprint } {
    const check = SecurityBouncerProxy.inspectAction('create_course', session);
    if (!check.allowed) {
      return { success: false, message: 'Faculty privileges required to create courses.' };
    }

    const newCourse = new CourseBlueprint(
      code.toUpperCase().trim(),
      title.trim(),
      session.name,
      term.trim(),
      `CO-${Math.floor(1000 + Math.random() * 9000)}`,
      '#eeeeee',
      0,
      [
        {
          unitNumber: 1,
          title: 'Introductory Fundamentals & Overview',
          topics: [
            {
              id: `top-${Date.now()}`,
              title: 'Course Introduction & Learning Outcomes',
              durationHours: 3,
              learningObjectives: ['Understand course milestones', 'Setup development toolchain'],
              isCompleted: false
            }
          ]
        }
      ],
      { quizzes: 20, assignments: 30, attendance: 10, finalExam: 40 },
      'Section A • Room 402 • 3.0 Credits',
      'No pending submissions yet',
      ['AI Assisted'],
      new Date().toISOString(),
      [],
      undefined,
      session.email
    );

    this.courses.unshift(newCourse);
    this.saveCoursesToStorage(this.courses);

    // Sync to Backend API
    (async () => {
      try {
        await api.createCourse({
          course_name: newCourse.title,
          course_code: newCourse.code,
          description: newCourse.sectionInfo || 'Academic Course',
          syllabus: 'Unit 1: Introductory Fundamentals & Overview',
        });
      } catch (e) {
        console.warn('Backend course creation sync notification:', e);
      }
    })();

    this.publisher.notify({
      id: `evt-create-${Date.now()}`,
      type: 'COURSE_CREATED',
      courseCode: newCourse.code,
      actor: session.name,
      actorRole: session.getRoleLabel(),
      payload: {
        title: newCourse.title,
        content: `Course created for ${newCourse.term}. Cohort Code: ${newCourse.cohortCode}`
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    return { success: true, message: 'New course created successfully!', course: newCourse };
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

  /**
   * Facade Method 4: Join Course via Matched Course Invitation ID / Class Code
   * Matches course cohortCode (or course code), validates student permissions,
   * adds student to enrolled roster, updates cohort count, and emits Academic Event.
   */
  public joinCourseByInvitationId(
    invitationId: string,
    session: IUserSession
  ): { success: boolean; message: string; course?: CourseBlueprint; alreadyEnrolled?: boolean } {
    const check = SecurityBouncerProxy.inspectAction('join_course', session);
    if (!check.allowed) {
      return {
        success: false,
        message: check.violation?.resource
          ? `${check.violation.resource}: ${check.violation.requiredRole}`
          : 'Unauthorized action'
      };
    }

    const cleanInput = (invitationId || '').trim().toLowerCase();
    if (!cleanInput) {
      return { success: false, message: 'Please enter a valid Course Invitation ID.' };
    }

    // Match against cohortCode (case-insensitive) or course code
    const course = this.courses.find(
      (c) => c.cohortCode.trim().toLowerCase() === cleanInput || c.code.trim().toLowerCase() === cleanInput
    );

    if (!course) {
      return {
        success: false,
        message: `No active academic course found matching invitation ID "${invitationId}". Please check the code with your instructor or CR.`
      };
    }

    // If teacher is the creator of the course, prevent redundant join
    if (session.role === 'teacher' && this.isTeacherCreator(course, session)) {
      return {
        success: false,
        alreadyEnrolled: true,
        course,
        message: `You are already the primary instructor and creator of ${course.code}.`
      };
    }

    // Ensure enrolled roster array is initialized
    if (!course.enrolledStudents) {
      course.enrolledStudents = [];
    }

    // Check if already enrolled/joined in this course
    const isEnrolled = course.enrolledStudents.some(
      (s) => s.email.toLowerCase() === session.email.toLowerCase() || s.id === session.id
    );

    if (isEnrolled) {
      return {
        success: false,
        alreadyEnrolled: true,
        course,
        message: session.role === 'teacher'
          ? `You have already joined ${course.code}: ${course.title}.`
          : `You are already enrolled in ${course.code}: ${course.title}.`
      };
    }

    // Enroll user in course blueprint (as faculty or student)
    const newStudent: EnrolledStudent = {
      id: session.id,
      name: session.name,
      email: session.email,
      roll: session.roll || (session.role === 'teacher' ? 'Faculty' : 'N/A'),
      avatar: session.avatar,
      joinedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    course.enrolledStudents.unshift(newStudent);
    course.studentsCount = Math.max((course.studentsCount || 0) + 1, course.enrolledStudents.length);
    this.saveCoursesToStorage(this.courses);

    // Sync to Backend API
    (async () => {
      try {
        await api.joinCourse(course.cohortCode || cleanInput);
      } catch (e) {
        console.warn('Backend course join sync notification:', e);
      }
    })();

    // Observer Pattern: Publish academic event & update audit/notification logs
    this.publisher.notify({
      id: `evt-join-${Date.now()}`,
      type: 'STUDENT_ENROLLED',
      courseCode: course.code,
      actor: session.name,
      actorRole: session.getRoleLabel(),
      payload: {
        title: `Course Enrollment: ${course.code}`,
        content: `${session.name} (${session.email}) joined ${course.title} using invitation ID: ${course.cohortCode}`,
        extra: { invitationId: course.cohortCode, studentEmail: session.email }
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    return {
      success: true,
      message: session.role === 'teacher'
        ? `Successfully joined ${course.code}: ${course.title} as teacher! You can now post announcements.`
        : `Successfully joined ${course.code}: ${course.title}!`,
      course
    };
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

  public getEnrolledCoursesForStudent(studentEmailOrId: string): CourseBlueprint[] {
    if (!studentEmailOrId) return [];
    const query = studentEmailOrId.toLowerCase();
    return this.courses.filter(
      (c) => (c.enrolledStudents || []).some(
        (s) => s.email.toLowerCase() === query || s.id.toLowerCase() === query
      )
    );
  }

  public getCoursesForTeacher(session: IUserSession): CourseBlueprint[] {
    if (!session) return [];
    return this.courses.filter((c) => {
      const isCreator = this.isTeacherCreator(c, session);
      const hasJoined = (c.enrolledStudents || []).some(
        (s) => s.email.toLowerCase() === session.email.toLowerCase() || s.id === session.id
      );
      return isCreator || hasJoined;
    });
  }

  public getCoursesForUser(session: IUserSession | null): CourseBlueprint[] {
    if (!session) return [];
    if (session.role === 'student' || session.role === 'cr') {
      return this.getEnrolledCoursesForStudent(session.email);
    }
    if (session.role === 'teacher') {
      return this.getCoursesForTeacher(session);
    }
    return [...this.courses];
  }

  public canUserAccessCourse(courseCode: string, session: IUserSession | null): boolean {
    if (!session) return false;
    if (session.role === 'admin') return true;
    const course = this.getCourseByCode(courseCode);
    if (!course) return false;
    if (session.role === 'teacher') {
      return this.isTeacherCreator(course, session) || this.isStudentEnrolled(courseCode, session.email);
    }
    return this.isStudentEnrolled(courseCode, session.email);
  }

  public canUserPostAnnouncement(courseCode: string, session: IUserSession | null): boolean {
    if (!session) return false;
    const course = this.getCourseByCode(courseCode);
    if (!course) return false;

    // Access-control matrix: only the course's assigned teacher posts official
    // announcements. CRs and students read and comment; admins have read-only access.
    return session.role === 'teacher' && this.isTeacherCreator(course, session);
  }

  public getCourseByInvitationId(invitationId: string): CourseBlueprint | undefined {
    const clean = (invitationId || '').trim().toLowerCase();
    if (!clean) return undefined;
    return this.courses.find(
      (c) => c.cohortCode.trim().toLowerCase() === clean || c.code.trim().toLowerCase() === clean
    );
  }
}
