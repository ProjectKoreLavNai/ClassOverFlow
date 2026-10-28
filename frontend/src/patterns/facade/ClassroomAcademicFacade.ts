/**
 * Milestone 2.2: Course Management & Announcements
 * Pattern 6: Facade Pattern (Classroom Academic Operations Facade)
 * 
 * Target: Provides a unified, simplified interface over multiple underlying
 * subsystems: Course Registry, Announcement Feed, Observer Event Publisher,
 * Security RBAC Enforcement, and Discord Webhook Streaming.
 * Satisfies the strict ≤3-click usability requirement.
 */

import { CourseBlueprint, type CurriculumUnit, type EnrolledStudent } from '../prototype/CoursePrototype';
import { CourseEventPublisher, type AcademicEvent } from '../observer/CourseEventPublisher';
import { SecurityBouncerProxy } from '../proxy/SecurityBouncerProxy';
import { getCourseTheme } from '../../utils/courseTheme';
import type { IUserSession } from '../../types/auth';
import api from '../../services/api';

export interface CourseAnnouncement {
  id: string;
  courseCode: string;
  authorName: string;
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

  private constructor() {
    this.publisher = CourseEventPublisher.getInstance();
    this.courses = this.loadCoursesFromStorage();
    this.announcements = this.loadAnnouncementsFromStorage();
    this.syncWithBackend().catch(() => {});
  }

  public async syncWithBackend(): Promise<void> {
    try {
      const backendCourses = await api.listCourses();
      if (Array.isArray(backendCourses) && backendCourses.length > 0) {
        for (const bc of backendCourses) {
          const existing = this.courses.find(c => c.code.toLowerCase() === bc.course_code.toLowerCase());
          if (!existing) {
            const blueprint = new CourseBlueprint(
              bc.course_code,
              bc.course_name,
              bc.teacher_email ? bc.teacher_email.split('@')[0] : 'Faculty',
              'Fall 2026',
              bc.class_code || `CO-${Math.floor(1000 + Math.random() * 9000)}`,
              '#eeeeee',
              0,
              [],
              { quizzes: 20, assignments: 30, attendance: 10, finalExam: 40 },
              'Section A • 3.0 Credits',
              'Active',
              ['Backend Synced'],
              bc.created_at || new Date().toISOString(),
              []
            );
            this.courses.push(blueprint);
          } else if (bc.class_code) {
            existing.cohortCode = bc.class_code;
          }
        }
        this.saveCoursesToStorage(this.courses);
      }
    } catch {
      // Backend not yet ready or offline
    }
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
  private getDefaultCourses(): CourseBlueprint[] {
    const defaultUnitsCSE3102: CurriculumUnit[] = [
      {
        unitNumber: 1,
        title: 'Requirements Engineering & UML Modeling',
        topics: [
          {
            id: 't-1',
            title: 'Use Case Modeling & SRS Documentation',
            durationHours: 3,
            learningObjectives: ['Draft actor-boundary diagrams', 'Establish functional requirements'],
            isCompleted: true
          },
          {
            id: 't-2',
            title: 'Class Diagrams & Object Structural Relationships',
            durationHours: 3,
            learningObjectives: ['Analyze aggregation vs composition', 'Implement dependency inversions'],
            isCompleted: true
          }
        ]
      },
      {
        unitNumber: 2,
        title: 'Creational & Structural Design Patterns',
        topics: [
          {
            id: 't-3',
            title: 'Singleton & Factory Method Patterns',
            durationHours: 4,
            learningObjectives: ['Single source of truth', 'Dynamic session instantiation'],
            isCompleted: true
          },
          {
            id: 't-4',
            title: 'Prototype & Facade Patterns',
            durationHours: 4,
            learningObjectives: ['Deep-copying course blueprints', 'Classroom unified operations facade'],
            isCompleted: true
          }
        ]
      },
      {
        unitNumber: 3,
        title: 'Behavioral Patterns & Architectural Reliability',
        topics: [
          {
            id: 't-5',
            title: 'Observer Pattern & Multi-Channel Event Bus',
            durationHours: 4,
            learningObjectives: ['Event-driven notifications', 'Discord webhook integrations'],
            isCompleted: false
          },
          {
            id: 't-6',
            title: 'Chain of Responsibility & RBAC Security Proxy',
            durationHours: 3,
            learningObjectives: ['Sequential security gates', 'HTTP 403 access control enforcement'],
            isCompleted: false
          }
        ]
      }
    ];

    const defaultUnitsCSE3101: CurriculumUnit[] = [
      {
        unitNumber: 1,
        title: 'Relational Model & Normalization',
        topics: [
          {
            id: 'db-1',
            title: '1NF, 2NF, 3NF & BCNF Normalization',
            durationHours: 4,
            learningObjectives: ['Functional dependencies', 'Lossless decomposition'],
            isCompleted: true
          },
          {
            id: 'db-2',
            title: 'Relational Algebra & Query Optimization',
            durationHours: 4,
            learningObjectives: ['Selection, projection, joins', 'Heuristic query optimization'],
            isCompleted: false
          }
        ]
      }
    ];

    const defaultUnitsCSE3104: CurriculumUnit[] = [
      {
        unitNumber: 1,
        title: 'Process Management & Concurrency',
        topics: [
          {
            id: 'os-1',
            title: 'Process Scheduling Algorithms (Round Robin, Multilevel)',
            durationHours: 4,
            learningObjectives: ['CPU scheduling metrics', 'Context switching overhead'],
            isCompleted: true
          },
          {
            id: 'os-2',
            title: 'Multithreading & Semaphore Synchronization',
            durationHours: 4,
            learningObjectives: ['Critical section problem', 'Dining philosophers solution'],
            isCompleted: false
          }
        ]
      }
    ];

    const defaultUnitsCSE3106: CurriculumUnit[] = [
      {
        unitNumber: 1,
        title: 'Supervised Learning & Optimization',
        topics: [
          {
            id: 'ml-1',
            title: 'Linear & Logistic Regression with Gradient Descent',
            durationHours: 4,
            learningObjectives: ['Loss function convexity', 'Learning rate tuning'],
            isCompleted: true
          },
          {
            id: 'ml-2',
            title: 'Neural Networks & Backpropagation',
            durationHours: 4,
            learningObjectives: ['Activation functions', 'Chain rule in weight updates'],
            isCompleted: true
          },
          {
            id: 'ml-3',
            title: 'Decision Trees & Random Forests',
            durationHours: 3,
            learningObjectives: ['Information gain & Gini impurity', 'Bagging ensemble methods'],
            isCompleted: false
          }
        ]
      }
    ];

    const defaultStudentsCSE3102: EnrolledStudent[] = [
      {
        id: 'usr-stud-1',
        name: 'Kiyotaka Ayanokoji',
        email: 'ayanokoji.student@university.edu',
        roll: '14',
        avatar: 'KA',
        joinedAt: 'Aug 15, 2026'
      },
      {
        id: 'usr-cr-1',
        name: 'Daemon Targaryen',
        email: 'daemon.cr@university.edu',
        roll: '55',
        avatar: 'DT',
        joinedAt: 'Aug 15, 2026'
      },
      {
        id: 'usr-adm-1',
        name: 'Aizen Sosuke',
        email: 'aizen.admin@university.edu',
        roll: '03',
        avatar: 'AS',
        joinedAt: 'Aug 15, 2026'
      }
    ];

    const defaultStudentsCSE3101: EnrolledStudent[] = [
      {
        id: 'usr-stud-1',
        name: 'Kiyotaka Ayanokoji',
        email: 'ayanokoji.student@university.edu',
        roll: '14',
        avatar: 'KA',
        joinedAt: 'Aug 16, 2026'
      },
      {
        id: 'usr-cr-1',
        name: 'Daemon Targaryen',
        email: 'daemon.cr@university.edu',
        roll: '55',
        avatar: 'DT',
        joinedAt: 'Aug 16, 2026'
      }
    ];

    const defaultStudentsCSE3104: EnrolledStudent[] = [
      {
        id: 'usr-cr-1',
        name: 'Daemon Targaryen',
        email: 'daemon.cr@university.edu',
        roll: '55',
        avatar: 'DT',
        joinedAt: 'Aug 17, 2026'
      }
    ];

    const defaultStudentsCSE3106: EnrolledStudent[] = [
      {
        id: 'usr-cr-1',
        name: 'Daemon Targaryen',
        email: 'daemon.cr@university.edu',
        roll: '55',
        avatar: 'DT',
        joinedAt: 'Aug 18, 2026'
      }
    ];

    return [
      // Card 1: CSE-3102 from index.html line 1443
      new CourseBlueprint(
        'CSE-3102',
        'CSE-3102: Software Design & Dev',
        'Gojo Satoru',
        'Fall 2026',
        'c7x9-cse3102',
        '#eeeeee', // display colour comes from getCourseTheme
        58,
        defaultUnitsCSE3102,
        { quizzes: 20, assignments: 30, attendance: 10, finalExam: 40 },
        'Section A • Room 402 • 3.0 Credits',
        'Due Friday, 11:59 PM: SRS Specification Draft',
        ['AI Assisted', 'Discord Synced'],
        '2026-08-15T00:00:00.000Z',
        defaultStudentsCSE3102
      ),
      // Card 2: CSE-3101 from index.html line 1473
      new CourseBlueprint(
        'CSE-3101',
        'CSE-3101: Database Systems',
        'Gojo Satoru',
        'Fall 2026',
        'd3b1-cse3101',
        '#eeeeee', // display colour comes from getCourseTheme
        58,
        defaultUnitsCSE3101,
        { quizzes: 20, assignments: 25, attendance: 15, finalExam: 40 },
        'Section A • Room 305 • 3.0 Credits',
        'Due Monday: Relational Algebra Lab 4',
        ['3 Tasks Active'],
        '2026-08-16T00:00:00.000Z',
        defaultStudentsCSE3101
      ),
      // Card 3: CSE-3104 from index.html line 1502
      new CourseBlueprint(
        'CSE-3104',
        'CSE-3104: Operating Systems',
        'Dr. Tanvir Ahmed',
        'Fall 2026',
        'os50-cse3104',
        '#eeeeee', // display colour comes from getCourseTheme
        60,
        defaultUnitsCSE3104,
        { quizzes: 10, assignments: 50, attendance: 10, finalExam: 30 },
        'Section A • Room 501 • 3.0 Credits',
        'Due Oct 29: Multithreading Semaphore Project',
        ['AI Quiz Ready'],
        '2026-08-17T00:00:00.000Z',
        defaultStudentsCSE3104
      ),
      // Card 4: CSE-3106 from index.html line 1531
      new CourseBlueprint(
        'CSE-3106',
        'CSE-3106: Machine Learning',
        'Dr. Nusrat Jahan',
        'Fall 2026',
        'ml78-cse3106',
        '#eeeeee', // display colour comes from getCourseTheme
        55,
        defaultUnitsCSE3106,
        { quizzes: 25, assignments: 35, attendance: 10, finalExam: 30 },
        'Section B • Lab 2 • 3.0 Credits',
        'Upcoming: Gradient Descent Analysis',
        ['Graded'],
        '2026-08-18T00:00:00.000Z',
        defaultStudentsCSE3106
      )
    ];
  }

  private loadCoursesFromStorage(): CourseBlueprint[] {
    try {
      const data = localStorage.getItem('classoverflow_courses_v2_5') || localStorage.getItem('classoverflow_courses_v2_4');
      if (data) {
        const parsed = JSON.parse(data);
        const defaults = this.getDefaultCourses();
        return parsed.map(
          (c: any, idx: number) => {
            const theme = getCourseTheme(c, idx);
            const matchingDefault = defaults.find((d) => d.code === c.code);
            const enrolled = Array.isArray(c.enrolledStudents) && c.enrolledStudents.length > 0
              ? c.enrolledStudents
              : (matchingDefault?.enrolledStudents || []);

            return new CourseBlueprint(
              c.code,
              c.title,
              c.instructor,
              c.term,
              c.cohortCode,
              theme.banner,
              c.studentsCount || (enrolled.length > 0 ? enrolled.length : 50),
              c.units,
              c.gradingWeights,
              c.sectionInfo,
              c.duePreview,
              c.tags,
              c.createdAt,
              enrolled
            );
          }
        );
      }
    } catch {}
    const defaults = this.getDefaultCourses();
    this.saveCoursesToStorage(defaults);
    return defaults;
  }

  private saveCoursesToStorage(courses: CourseBlueprint[]): void {
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
      ['AI Assisted']
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

    // Ensure enrolled roster array is initialized
    if (!course.enrolledStudents) {
      course.enrolledStudents = [];
    }

    // Check if already enrolled in this course
    const isEnrolled = course.enrolledStudents.some(
      (s) => s.email.toLowerCase() === session.email.toLowerCase() || s.id === session.id
    );

    if (isEnrolled) {
      return {
        success: false,
        alreadyEnrolled: true,
        course,
        message: `You are already enrolled in ${course.code}: ${course.title}.`
      };
    }

    // Enroll student in course blueprint
    const newStudent: EnrolledStudent = {
      id: session.id,
      name: session.name,
      email: session.email,
      roll: session.roll || 'N/A',
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
      message: `Successfully joined ${course.code}: ${course.title}!`,
      course
    };
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

  public getCourseByInvitationId(invitationId: string): CourseBlueprint | undefined {
    const clean = (invitationId || '').trim().toLowerCase();
    if (!clean) return undefined;
    return this.courses.find(
      (c) => c.cohortCode.trim().toLowerCase() === clean || c.code.trim().toLowerCase() === clean
    );
  }
}
