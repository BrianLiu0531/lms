import { prisma } from '../db.js';
import { courseGrade, progressPercent, type ProgressCounts } from './grading.js';

export interface StudentProgress extends ProgressCounts {
  percent: number;
  grade: number | null;
}

/**
 * Progress and grade for many students in one course using a fixed number of
 * queries (no N+1), so a roster of hundreds of students stays cheap.
 */
export async function courseProgress(courseId: string, userIds: string[]): Promise<Map<string, StudentProgress>> {
  const [lessons, assignments, quizzes] = await Promise.all([
    prisma.lesson.findMany({ where: { module: { courseId } }, select: { id: true } }),
    prisma.assignment.findMany({ where: { courseId }, select: { id: true, maxPoints: true } }),
    prisma.quiz.findMany({ where: { courseId }, select: { id: true, passMark: true } }),
  ]);

  const [completions, submissions, bestAttempts] = await Promise.all([
    prisma.lessonCompletion.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, lessonId: { in: lessons.map((l) => l.id) } },
      _count: { _all: true },
    }),
    prisma.submission.findMany({
      where: { studentId: { in: userIds }, assignmentId: { in: assignments.map((a) => a.id) } },
      select: { studentId: true, assignmentId: true, grade: true },
    }),
    prisma.quizAttempt.groupBy({
      by: ['studentId', 'quizId'],
      where: { studentId: { in: userIds }, quizId: { in: quizzes.map((q) => q.id) } },
      _max: { percent: true },
    }),
  ]);

  const maxPoints = new Map(assignments.map((a) => [a.id, a.maxPoints]));
  const passMark = new Map(quizzes.map((q) => [q.id, q.passMark]));
  const result = new Map<string, StudentProgress>();

  for (const userId of userIds) {
    const mySubmissions = submissions.filter((s) => s.studentId === userId);
    const myBest = bestAttempts.filter((a) => a.studentId === userId);
    const counts: ProgressCounts = {
      lessonsTotal: lessons.length,
      lessonsDone: completions.find((c) => c.userId === userId)?._count._all ?? 0,
      assignmentsTotal: assignments.length,
      assignmentsSubmitted: mySubmissions.length,
      quizzesTotal: quizzes.length,
      quizzesPassed: myBest.filter((a) => (a._max.percent ?? 0) >= (passMark.get(a.quizId) ?? 100)).length,
    };
    result.set(userId, {
      ...counts,
      percent: progressPercent(counts),
      grade: courseGrade(
        mySubmissions.map((s) => ({ maxPoints: maxPoints.get(s.assignmentId)!, grade: s.grade })),
        myBest.map((a) => ({ bestPercent: a._max.percent })),
      ),
    });
  }
  return result;
}
