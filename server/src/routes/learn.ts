import { Router } from 'express';
import { prisma } from '../db.js';
import { assertCanLearn, assertStudent } from '../lib/access.js';
import { gradeQuiz } from '../lib/grading.js';
import { HttpError } from '../lib/http.js';
import { currentUser } from '../middleware/auth.js';
import { attemptSchema, submitSchema } from '../schemas.js';

// Mounted behind requireAuth. Lessons, assignments and quizzes from a learner's point of view.
export const learnRouter = Router();

learnRouter.get('/lessons/:id', async (req, res) => {
  const user = currentUser(req);
  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.id },
    include: { module: { select: { title: true, courseId: true } } },
  });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  await assertCanLearn(user, lesson.module.courseId);

  // Flatten the course outline to find the previous / next lesson across modules
  const outline = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.courseId } },
    orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
    select: { id: true },
  });
  const index = outline.findIndex((l) => l.id === lesson.id);
  const completed = await prisma.lessonCompletion.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
  });

  res.json({
    ...lesson,
    courseId: lesson.module.courseId,
    completed: !!completed,
    prevLessonId: outline[index - 1]?.id ?? null,
    nextLessonId: outline[index + 1]?.id ?? null,
  });
});

async function lessonCourseId(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  return lesson.module.courseId;
}

learnRouter.post('/lessons/:id/complete', async (req, res) => {
  const user = currentUser(req);
  assertStudent(user);
  await assertCanLearn(user, await lessonCourseId(req.params.id));
  await prisma.lessonCompletion.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: req.params.id } },
    create: { userId: user.id, lessonId: req.params.id },
    update: {},
  });
  res.status(204).end();
});

learnRouter.delete('/lessons/:id/complete', async (req, res) => {
  const user = currentUser(req);
  await prisma.lessonCompletion.deleteMany({ where: { userId: user.id, lessonId: req.params.id } });
  res.status(204).end();
});

learnRouter.get('/assignments/:id', async (req, res) => {
  const user = currentUser(req);
  const assignment = await prisma.assignment.findUnique({
    where: { id: req.params.id },
    include: { course: { select: { id: true, code: true, title: true } } },
  });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  await assertCanLearn(user, assignment.courseId);
  const submission = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: user.id } },
  });
  res.json({ ...assignment, submission });
});

learnRouter.post('/assignments/:id/submit', async (req, res) => {
  const user = currentUser(req);
  assertStudent(user);
  const { content } = submitSchema.parse(req.body);
  const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  await assertCanLearn(user, assignment.courseId);

  const key = { assignmentId_studentId: { assignmentId: assignment.id, studentId: user.id } };
  const existing = await prisma.submission.findUnique({ where: key });
  if (existing?.grade != null) throw new HttpError(409, 'This assignment has already been graded');

  // Resubmitting before grading replaces the previous version
  const submission = await prisma.submission.upsert({
    where: key,
    create: { assignmentId: assignment.id, studentId: user.id, content },
    update: { content, submittedAt: new Date() },
  });
  res.status(existing ? 200 : 201).json({ ...submission, late: submission.submittedAt > assignment.dueAt });
});

learnRouter.get('/quizzes/:id', async (req, res) => {
  const user = currentUser(req);
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: {
      course: { select: { id: true, code: true, title: true } },
      // correctIndex is intentionally not selected
      questions: { orderBy: { position: 'asc' }, select: { id: true, prompt: true, options: true } },
    },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await assertCanLearn(user, quiz.courseId);
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: quiz.id, studentId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, correct: true, total: true, percent: true, createdAt: true },
  });
  res.json({ ...quiz, attempts, attemptsLeft: Math.max(0, quiz.maxAttempts - attempts.length) });
});

learnRouter.post('/quizzes/:id/attempts', async (req, res) => {
  const user = currentUser(req);
  assertStudent(user);
  const { answers } = attemptSchema.parse(req.body);
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { position: 'asc' } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await assertCanLearn(user, quiz.courseId);

  if (answers.length !== quiz.questions.length || answers.some((a, i) => a >= quiz.questions[i].options.length)) {
    throw new HttpError(400, 'Answer every question with one of its options');
  }
  const used = await prisma.quizAttempt.count({ where: { quizId: quiz.id, studentId: user.id } });
  if (used >= quiz.maxAttempts) throw new HttpError(409, 'No attempts remaining for this quiz');

  const result = gradeQuiz(quiz.questions, answers);
  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, studentId: user.id, answers, correct: result.correct, total: result.total, percent: result.percent },
  });
  res.status(201).json({
    id: attempt.id,
    ...result,
    passed: result.percent >= quiz.passMark,
    attemptsLeft: quiz.maxAttempts - used - 1,
  });
});
