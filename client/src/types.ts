export type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentNumber: string | null;
}

export interface Progress {
  percent: number;
  grade: number | null;
  lessonsTotal: number;
  lessonsDone: number;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  quizzesTotal: number;
  quizzesPassed: number;
}

export interface CatalogueCourse {
  id: string;
  code: string;
  title: string;
  summary: string;
  instructor: { name: string };
  lessonCount: number;
  studentCount: number;
  enrolled: boolean;
}

export interface CourseOutline {
  id: string;
  code: string;
  title: string;
  summary: string;
  published: boolean;
  instructor: { name: string };
  modules: { id: string; title: string; lessons: { id: string; title: string; minutes: number }[] }[];
  assignments: { id: string; title: string; dueAt: string; maxPoints: number }[];
  quizzes: { id: string; title: string; passMark: number; maxAttempts: number; _count: { questions: number } }[];
  canTeach: boolean;
  enrolled: boolean;
  learner: {
    enrolledAt: string;
    completedLessonIds: string[];
    submissions: Record<string, { submittedAt: string; grade: number | null }>;
    quizzes: Record<string, { best: number | null; attempts: number }>;
    progress: Progress;
  } | null;
}

export interface LessonView {
  id: string;
  title: string;
  content: string;
  minutes: number;
  courseId: string;
  module: { title: string };
  completed: boolean;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

export interface Submission {
  id: string;
  content: string;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
}

export interface AssignmentView {
  id: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxPoints: number;
  course: { id: string; code: string; title: string };
  submission: Submission | null;
}

export interface QuizView {
  id: string;
  title: string;
  passMark: number;
  maxAttempts: number;
  course: { id: string; code: string; title: string };
  questions: { id: string; prompt: string; options: string[] }[];
  attempts: { id: string; correct: number; total: number; percent: number; createdAt: string }[];
  attemptsLeft: number;
}

export interface AttemptResult {
  id: string;
  correct: number;
  total: number;
  percent: number;
  results: boolean[];
  passed: boolean;
  attemptsLeft: number;
}

export interface Dashboard {
  courses: { id: string; code: string; title: string; instructor: { name: string }; enrolledAt: string; progress: Progress }[];
  upcoming: { id: string; title: string; dueAt: string; maxPoints: number; course: { code: string } }[];
  recentGrades: {
    id: string;
    grade: number;
    gradedAt: string;
    assignment: { id: string; title: string; maxPoints: number; course: { code: string } };
  }[];
}

export interface QuestionInput {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface QuizInput {
  title: string;
  passMark: number;
  maxAttempts: number;
  questions: QuestionInput[];
}

export interface TeachCourseSummary {
  id: string;
  code: string;
  title: string;
  published: boolean;
  instructor: { name: string };
  _count: { enrollments: number; assignments: number; quizzes: number };
}

export interface BuilderLesson {
  id: string;
  title: string;
  content: string;
  minutes: number;
}

export interface BuilderCourse {
  id: string;
  code: string;
  title: string;
  summary: string;
  published: boolean;
  instructor: { name: string };
  modules: { id: string; title: string; lessons: BuilderLesson[] }[];
  assignments: { id: string; title: string; instructions: string; dueAt: string; maxPoints: number; _count: { submissions: number } }[];
  quizzes: (QuizInput & { id: string; questions: (QuestionInput & { id: string })[]; _count: { attempts: number } })[];
  _count: { enrollments: number };
}

export interface RosterEntry {
  id: string;
  name: string;
  email: string;
  studentNumber: string | null;
  enrolledAt: string;
  progress: Progress;
}

export interface SubmissionsView {
  assignment: { id: string; title: string; instructions: string; dueAt: string; maxPoints: number; course: { id: string; code: string; title: string } };
  submissions: (Submission & { late: boolean; student: { id: string; name: string; studentNumber: string | null } })[];
  notSubmitted: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentNumber: string | null;
  createdAt: string;
  _count: { enrollments: number; teaching: number };
}

export interface AdminUserDetail extends Omit<AdminUserRow, '_count'> {
  enrollments: { enrolledAt: string; course: { id: string; code: string; title: string }; progress: Progress }[];
  teaching: { id: string; code: string; title: string; published: boolean }[];
}

export interface AdminStats {
  users: Partial<Record<Role, number>>;
  courses: { published: number; drafts: number };
  enrollments: number;
  ungraded: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
