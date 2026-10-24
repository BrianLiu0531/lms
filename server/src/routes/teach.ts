import { Router } from 'express';
import { prisma } from '../db.js';
import { teachableCourse } from '../lib/access.js';
import { HttpError } from '../lib/http.js';
import { courseProgress } from '../lib/progress.js';
import { currentUser, type AuthUser } from '../middleware/auth.js';
import {
  assignmentSchema,
  courseSchema,
  courseUpdateSchema,
  gradeSchema,
  lessonSchema,
  moduleSchema,
  quizSchema,
} from '../schemas.js';

// Mounted behind requireRole('INSTRUCTOR', 'ADMIN'). All writes check course ownership.
export const teachRouter = Router();

/** Resolves the course that owns a piece of content, then applies the ownership check. */
async function ownerCourse(user: AuthUser, find: () => Promise<{ courseId: string } | null>, what: string) {
  const found = await find();
  if (!found) throw new HttpError(404, `${what} not found`);
  return teachableCourse(user, found.courseId);
}

const moduleOwner = (user: AuthUser, id: string) =>
  ownerCourse(user, () => prisma.module.findUnique({ where: { id }, select: { courseId: true } }), 'Module');
const lessonOwner = (user: AuthUser, id: string) =>
  ownerCourse(
    user,
    async () => {
      const l = await prisma.lesson.findUnique({ where: { id }, select: { module: { select: { courseId: true } } } });
      return l && { courseId: l.module.courseId };
    },
    'Lesson',
  );
const assignmentOwner = (user: AuthUser, id: string) =>
  ownerCourse(user, () => prisma.assignment.findUnique({ where: { id }, select: { courseId: true } }), 'Assignment');
const quizOwner = (user: AuthUser, id: string) =>
  ownerCourse(user, () => prisma.quiz.findUnique({ where: { id }, select: { courseId: true } }), 'Quiz');

// ---- Courses ----

teachRouter.get('/courses', async (req, res) => {
  const user = currentUser(req);
  const courses = await prisma.course.findMany({
    where: user.role === 'ADMIN' ? {} : { instructorId: user.id },
    orderBy: { code: 'asc' },
    include: {
      instructor: { select: { name: true } },
      _count: { select: { enrollments: true, assignments: true, quizzes: true } },
    },
  });
  res.json(courses);
});

teachRouter.post('/courses', async (req, res) => {
  const user = currentUser(req);
  if (user.role !== 'INSTRUCTOR') throw new HttpError(403, 'Only instructors can create courses');
  const course = await prisma.course.create({ data: { ...courseSchema.parse(req.body), instructorId: user.id } });
  res.status(201).json(course);
});

/** Full course for the builder, including quiz answers. */
teachRouter.get('/courses/:id', async (req, res) => {
  await teachableCourse(currentUser(req), req.params.id);
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      instructor: { select: { name: true } },
      modules: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' } } } },
      assignments: { orderBy: { dueAt: 'asc' }, include: { _count: { select: { submissions: true } } } },
      quizzes: {
        orderBy: { createdAt: 'asc' },
        include: { questions: { orderBy: { position: 'asc' } }, _count: { select: { attempts: true } } },
      },
      _count: { select: { enrollments: true } },
    },
  });
  res.json(course);
});

teachRouter.put('/courses/:id', async (req, res) => {
  const data = courseUpdateSchema.parse(req.body);
  const course = await teachableCourse(currentUser(req), req.params.id);
  if (data.published && !course.published) {
    const lessons = await prisma.lesson.count({ where: { module: { courseId: course.id } } });
    if (lessons === 0) throw new HttpError(409, 'Add at least one lesson before publishing');
  }
  res.json(await prisma.course.update({ where: { id: course.id }, data }));
});

teachRouter.delete('/courses/:id', async (req, res) => {
  const course = await teachableCourse(currentUser(req), req.params.id);
  const enrolled = await prisma.enrollment.count({ where: { courseId: course.id } });
  if (enrolled > 0) throw new HttpError(409, 'Unpublish and remove enrolled students before deleting this course');
  await prisma.course.delete({ where: { id: course.id } });
  res.status(204).end();
});

// ---- Modules & lessons ----

teachRouter.post('/courses/:id/modules', async (req, res) => {
  const { title } = moduleSchema.parse(req.body);
  const course = await teachableCourse(currentUser(req), req.params.id);
  const position = await prisma.module.count({ where: { courseId: course.id } });
  res.status(201).json(await prisma.module.create({ data: { title, courseId: course.id, position } }));
});

teachRouter.put('/modules/:id', async (req, res) => {
  const { title } = moduleSchema.parse(req.body);
  await moduleOwner(currentUser(req), req.params.id);
  res.json(await prisma.module.update({ where: { id: req.params.id }, data: { title } }));
});

teachRouter.delete('/modules/:id', async (req, res) => {
  await moduleOwner(currentUser(req), req.params.id);
  await prisma.module.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

teachRouter.post('/modules/:id/lessons', async (req, res) => {
  const data = lessonSchema.parse(req.body);
  await moduleOwner(currentUser(req), req.params.id);
  const position = await prisma.lesson.count({ where: { moduleId: req.params.id } });
  res.status(201).json(await prisma.lesson.create({ data: { ...data, moduleId: req.params.id, position } }));
});

teachRouter.put('/lessons/:id', async (req, res) => {
  const data = lessonSchema.parse(req.body);
  await lessonOwner(currentUser(req), req.params.id);
  res.json(await prisma.lesson.update({ where: { id: req.params.id }, data }));
});

teachRouter.delete('/lessons/:id', async (req, res) => {
  await lessonOwner(currentUser(req), req.params.id);
  await prisma.lesson.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ---- Assignments & grading ----

teachRouter.post('/courses/:id/assignments', async (req, res) => {
  const data = assignmentSchema.parse(req.body);
  const course = await teachableCourse(currentUser(req), req.params.id);
  res.status(201).json(await prisma.assignment.create({ data: { ...data, courseId: course.id } }));
});

teachRouter.put('/assignments/:id', async (req, res) => {
  const data = assignmentSchema.parse(req.body);
  await assignmentOwner(currentUser(req), req.params.id);
  const highest = await prisma.submission.aggregate({ where: { assignmentId: req.params.id }, _max: { grade: true } });
  if ((highest._max.grade ?? 0) > data.maxPoints) {
    throw new HttpError(409, 'Max points cannot be lower than a grade already awarded');
  }
  res.json(await prisma.assignment.update({ where: { id: req.params.id }, data }));
});

teachRouter.delete('/assignments/:id', async (req, res) => {
  await assignmentOwner(currentUser(req), req.params.id);
  await prisma.assignment.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

teachRouter.get('/assignments/:id/submissions', async (req, res) => {
  const course = await assignmentOwner(currentUser(req), req.params.id);
  const [assignment, submissions, enrolled] = await Promise.all([
    prisma.assignment.findUniqueOrThrow({ where: { id: req.params.id } }),
    prisma.submission.findMany({
      where: { assignmentId: req.params.id },
      orderBy: { submittedAt: 'asc' },
      include: { student: { select: { id: true, name: true, studentNumber: true } } },
    }),
    prisma.enrollment.count({ where: { courseId: course.id } }),
  ]);
  res.json({
    assignment: { ...assignment, course: { id: course.id, code: course.code, title: course.title } },
    submissions: submissions.map((s) => ({ ...s, late: s.submittedAt > assignment.dueAt })),
    notSubmitted: Math.max(0, enrolled - submissions.length),
  });
});

teachRouter.patch('/submissions/:id', async (req, res) => {
  const { grade, feedback } = gradeSchema.parse(req.body);
  const submission = await prisma.submission.findUnique({
    where: { id: req.params.id },
    include: { assignment: { select: { courseId: true, maxPoints: true } } },
  });
  if (!submission) throw new HttpError(404, 'Submission not found');
  await teachableCourse(currentUser(req), submission.assignment.courseId);
  if (grade > submission.assignment.maxPoints) {
    throw new HttpError(400, `Grade cannot exceed ${submission.assignment.maxPoints} points`);
  }
  res.json(await prisma.submission.update({ where: { id: submission.id }, data: { grade, feedback, gradedAt: new Date() } }));
});

// ---- Quizzes ----

teachRouter.post('/courses/:id/quizzes', async (req, res) => {
  const { questions, ...data } = quizSchema.parse(req.body);
  const course = await teachableCourse(currentUser(req), req.params.id);
  const quiz = await prisma.quiz.create({
    data: { ...data, courseId: course.id, questions: { create: questions.map((q, position) => ({ ...q, position })) } },
    include: { questions: { orderBy: { position: 'asc' } } },
  });
  res.status(201).json(quiz);
});

teachRouter.put('/quizzes/:id', async (req, res) => {
  const { questions, ...data } = quizSchema.parse(req.body);
  await quizOwner(currentUser(req), req.params.id);
  const current = await prisma.quiz.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { questions: { orderBy: { position: 'asc' } }, _count: { select: { attempts: true } } },
  });

  // Changing questions after students have attempted the quiz would invalidate their scores
  const shape = (qs: { prompt: string; options: string[]; correctIndex: number }[]) =>
    JSON.stringify(qs.map(({ prompt, options, correctIndex }) => ({ prompt, options, correctIndex })));
  const questionsChanged = shape(current.questions) !== shape(questions);
  if (questionsChanged && current._count.attempts > 0) {
    throw new HttpError(409, 'Questions cannot be changed after students have attempted this quiz');
  }

  const quiz = await prisma.$transaction(async (tx) => {
    if (questionsChanged) {
      await tx.quizQuestion.deleteMany({ where: { quizId: current.id } });
      await tx.quizQuestion.createMany({ data: questions.map((q, position) => ({ ...q, position, quizId: current.id })) });
    }
    return tx.quiz.update({
      where: { id: current.id },
      data,
      include: { questions: { orderBy: { position: 'asc' } } },
    });
  });
  res.json(quiz);
});

teachRouter.delete('/quizzes/:id', async (req, res) => {
  await quizOwner(currentUser(req), req.params.id);
  await prisma.quiz.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ---- Roster ----

teachRouter.get('/courses/:id/students', async (req, res) => {
  const course = await teachableCourse(currentUser(req), req.params.id);
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id },
    orderBy: { user: { name: 'asc' } },
    include: { user: { select: { id: true, name: true, email: true, studentNumber: true } } },
  });
  const progress = await courseProgress(course.id, enrollments.map((e) => e.userId));
  res.json(enrollments.map((e) => ({ ...e.user, enrolledAt: e.enrolledAt, progress: progress.get(e.userId) })));
});
