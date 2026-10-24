import { Router } from 'express';
import { prisma } from '../db.js';
import { courseProgress } from '../lib/progress.js';
import { currentUser } from '../middleware/auth.js';

// Mounted behind requireRole('STUDENT')
export const meRouter = Router();

meRouter.get('/dashboard', async (req, res) => {
  const userId = currentUser(req).id;
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, course: { published: true } },
    orderBy: { enrolledAt: 'desc' },
    include: { course: { select: { id: true, code: true, title: true, instructor: { select: { name: true } } } } },
  });
  const courseIds = enrollments.map((e) => e.courseId);

  const [progressList, upcoming, recentGrades] = await Promise.all([
    Promise.all(courseIds.map(async (id) => [id, (await courseProgress(id, [userId])).get(userId)!] as const)),
    prisma.assignment.findMany({
      where: { courseId: { in: courseIds }, dueAt: { gte: new Date() }, submissions: { none: { studentId: userId } } },
      orderBy: { dueAt: 'asc' },
      take: 5,
      select: { id: true, title: true, dueAt: true, maxPoints: true, course: { select: { code: true } } },
    }),
    prisma.submission.findMany({
      where: { studentId: userId, grade: { not: null } },
      orderBy: { gradedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        grade: true,
        gradedAt: true,
        assignment: { select: { id: true, title: true, maxPoints: true, course: { select: { code: true } } } },
      },
    }),
  ]);
  const progress = new Map(progressList);

  res.json({
    courses: enrollments.map((e) => ({ ...e.course, enrolledAt: e.enrolledAt, progress: progress.get(e.courseId) })),
    upcoming,
    recentGrades,
  });
});
