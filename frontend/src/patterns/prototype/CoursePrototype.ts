/**
 * Milestone 2.2: Course Management & Announcements
 * Pattern 5: Prototype Pattern (Course Syllabus Deep Cloning)
 * 
 * Target: Deep-copying course syllabus outlines, units, and learning objectives
 * for new cohorts without re-entering data from scratch.
 * Resets progress checkboxes to 0% and generates a unique enrollment code.
 */

export interface ICloneable<T> {
  clone(): T;
}

export interface SyllabusTopic {
  id: string;
  title: string;
  durationHours: number;
  learningObjectives: string[];
  isCompleted: boolean;
}

export interface CurriculumUnit {
  unitNumber: number;
  title: string;
  topics: SyllabusTopic[];
}

export interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  roll?: string;
  avatar?: string;
  joinedAt: string;
}

export class CourseBlueprint implements ICloneable<CourseBlueprint> {
  public code: string;
  public title: string;
  public instructor: string;
  public term: string;
  public cohortCode: string;
  public bannerBg: string;
  public studentsCount: number;
  public units: CurriculumUnit[];
  public gradingWeights: { quizzes: number; assignments: number; attendance: number; finalExam: number };
  public sectionInfo: string;
  public duePreview: string;
  public tags: string[];
  public createdAt: string;
  public enrolledStudents: EnrolledStudent[];
  public courseId?: number;

  constructor(
    code: string,
    title: string,
    instructor: string,
    term: string,
    cohortCode: string,
    bannerBg: string,
    studentsCount: number,
    units: CurriculumUnit[],
    gradingWeights: { quizzes: number; assignments: number; attendance: number; finalExam: number },
    sectionInfo: string = 'Section A • Room 402 • 3.0 Credits',
    duePreview: string = '',
    tags: string[] = [],
    createdAt?: string,
    enrolledStudents: EnrolledStudent[] = [],
    courseId?: number
  ) {
    this.code = code;
    this.title = title;
    this.instructor = instructor;
    this.term = term;
    this.cohortCode = cohortCode;
    this.bannerBg = bannerBg;
    this.studentsCount = studentsCount;
    this.units = units;
    this.gradingWeights = gradingWeights;
    this.sectionInfo = sectionInfo;
    this.duePreview = duePreview;
    this.tags = tags;
    this.createdAt = createdAt || new Date().toISOString();
    this.enrolledStudents = enrolledStudents;
    this.courseId = courseId;
  }

  /**
   * Deep clone implementation: copies all curriculum units and topics,
   * completely decoupling the new clone from the original instance.
   */
  public clone(): CourseBlueprint {
    const clonedUnits: CurriculumUnit[] = this.units.map((unit) => ({
      unitNumber: unit.unitNumber,
      title: unit.title,
      topics: unit.topics.map((t) => ({
        id: `topic-${Math.random().toString(36).substring(2, 9)}`,
        title: t.title,
        durationHours: t.durationHours,
        learningObjectives: [...t.learningObjectives],
        isCompleted: false // Progress always resets to 0% on clone
      }))
    }));

    return new CourseBlueprint(
      this.code,
      this.title,
      this.instructor,
      this.term,
      `CO-${Math.floor(1000 + Math.random() * 9000)}`, // New cohort join code
      this.bannerBg,
      0, // Reset enrolled students count
      clonedUnits,
      { ...this.gradingWeights },
      this.sectionInfo,
      'No pending submissions yet (New Course)',
      [...this.tags],
      new Date().toISOString(),
      [], // Reset enrolled students roster
      this.instructorEmail
    );
  }

  /**
   * Domain-specific Prototype method for instantiating a new semester cohort.
   * Clones units and syllabus, assigns new term and code in under 150ms.
   */
  public cloneForNewCohort(newCohortTitle: string, newTerm: string, newCode?: string): CourseBlueprint {
    const clone = this.clone();
    if (newCode) clone.code = newCode;
    clone.title = newCohortTitle;
    clone.term = newTerm;
    clone.instructorEmail = this.instructorEmail;
    return clone;
  }
}
