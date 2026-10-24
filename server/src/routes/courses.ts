import { Router } from 'express';
import { prisma } from '../db.js';
import { assertStudent, canTeach } from '../lib/access.js';
import { HttpError } from '../lib/http.js';
import { courseProgress } from '../lib/progress.js';
import { currentUser } from '../middleware/auth.js';

// Mounted behind requireAuth
export const coursesRouter = Router();

/** Catalogue of published courses. */
coursesRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const courses = await prisma.course.findMany({
    where: { published: true },
    orderBy: { code: 'asc' },
    include: {
      instructor: { select: { name: true } },
      modules: { select: { _count: { select: { lessons: true } } } },
      _count: { select: { enrollments: true } },
      enrollments: { where: { userId: user.id }, select: { userId: true } },
    },
  });
  res.json(
    courses.map(({ modules, enrollments, _count, ...c }) => ({
      ...c,
      lessonCount: modules.reduce((n, m) => n + m._count.lessons, 0),
      studentCount: _count.enrollments,
      enrolled: enrollments.length > 0,
    })),
  );
});

/** Syllabus view. Lesson content and quiz answers are deliberately excluded. */
coursesRouter.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: {
      instructor: { select: { name: true } },
      modules: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true, minutes: true } } },
      },
      assignments: { orderBy: { dueAt: 'asc' }, select: { id: true, title: true, dueAt: true, maxPoints: true } },
      quizzes: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, passMark: true, maxAttempts: true, _count: { select: { questions: true } } },
      },
    },
  });
  const teacher = course ? await canTeach(user, course.id) : false;
  if (!course || (!course.published && !teacher)) throw new HttpError(404, 'Course not found');

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
  });

  let learner = null;
  if (enrollment) {
    const [completions, submissions, attempts, progress] = await Promise.all([
      prisma.lessonCompletion.findMany({
        where: { userId: user.id, lesson: { module: { courseId: course.id } } },
        select: { lessonId: true },
      }),
      prisma.submission.findMany({
        where: { studentId: user.id, assignment: { courseId: course.id } },
        select: { assignmentId: true, submittedAt: true, grade: true },
      }),
      prisma.quizAttempt.groupBy({
        by: ['quizId'],
        where: { studentId: user.id, quiz: { courseId: course.id } },
        _max: { percent: true },
        _count: { _all: true },
      }),
      courseProgress(course.id, [user.id]),
    ]);
    learner = {
      enrolledAt: enrollment.enrolledAt,
      completedLessonIds: completions.map((c) => c.lessonId),
      submissions: Object.fromEntries(submissions.map((s) => [s.assignmentId, s])),
      quizzes: Object.fromEntries(attempts.map((a) => [a.quizId, { best: a._max.percent, attempts: a._count._all }])),
      progress: progress.get(user.id),
    };
  }

  res.json({ ...course, canTeach: teacher, enrolled: !!enrollment, learner });
});

coursesRouter.post('/:id/enroll', async (req, res) => {
  const user = currentUser(req);
  assertStudent(user);
  const course = await prisma.course.findFirst({ where: { id: req.params.id, published: true }, select: { id: true } });
  if (!course) throw new HttpError(404, 'Course not found');
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    create: { userId: user.id, courseId: course.id },
    update: {},
  });
  res.status(204).end();
});

coursesRouter.delete('/:id/enroll', async (req, res) => {
  const user = currentUser(req);
  assertStudent(user);
  await prisma.enrollment.deleteMany({ where: { userId: user.id, courseId: req.params.id } });
  res.status(204).end();
});
