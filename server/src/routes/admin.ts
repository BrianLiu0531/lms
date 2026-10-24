import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, pageOf } from '../lib/http.js';
import { courseProgress } from '../lib/progress.js';
import { createUserWithNumber } from '../lib/studentNumber.js';
import { currentUser } from '../middleware/auth.js';
import { adminCreateUserSchema, adminUpdateUserSchema, adminUserQuerySchema, enrollSchema } from '../schemas.js';

// Mounted behind requireRole('ADMIN'). Student records management (create / view / update / delete).
export const adminRouter = Router();

const PAGE_SIZE = 20;
const userSummary = { id: true, name: true, email: true, role: true, studentNumber: true, createdAt: true } as const;

adminRouter.get('/stats', async (_req, res) => {
  const [roles, published, drafts, enrollments, ungraded] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.course.count({ where: { published: true } }),
    prisma.course.count({ where: { published: false } }),
    prisma.enrollment.count(),
    prisma.submission.count({ where: { grade: null } }),
  ]);
  res.json({
    users: Object.fromEntries(roles.map((r) => [r.role, r._count._all])),
    courses: { published, drafts },
    enrollments,
    ungraded,
  });
});

adminRouter.get('/users', async (req, res) => {
  const { search, role, page } = adminUserQuerySchema.parse(req.query);
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.UserWhereInput = {
    role,
    OR: search ? [{ name: contains }, { email: contains }, { studentNumber: contains }] : undefined,
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      ...pageOf(page, PAGE_SIZE),
      select: { ...userSummary, _count: { select: { enrollments: true, teaching: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ items, total, page, pageSize: PAGE_SIZE });
});

adminRouter.post('/users', async (req, res) => {
  const { password, ...data } = adminCreateUserSchema.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const user = await createUserWithNumber({ ...data, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: userSummary }));
});

adminRouter.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      ...userSummary,
      enrollments: {
        orderBy: { enrolledAt: 'desc' },
        select: { enrolledAt: true, course: { select: { id: true, code: true, title: true } } },
      },
      teaching: { select: { id: true, code: true, title: true, published: true } },
    },
  });
  if (!user) throw new HttpError(404, 'User not found');

  const progress = await Promise.all(
    user.enrollments.map(async (e) => (await courseProgress(e.course.id, [user.id])).get(user.id)),
  );
  res.json({ ...user, enrollments: user.enrollments.map((e, i) => ({ ...e, progress: progress[i] })) });
});

adminRouter.put('/users/:id', async (req, res) => {
  const data = adminUpdateUserSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role !== 'STUDENT' && data.studentNumber) {
    throw new HttpError(400, 'Only students have a student number');
  }
  const user = await prisma.user.update({
    where: { id: target.id },
    // A student's number can be corrected but never removed
    data: { ...data, studentNumber: target.role === 'STUDENT' ? (data.studentNumber ?? target.studentNumber) : null },
    select: userSummary,
  });
  res.json(user);
});

adminRouter.delete('/users/:id', async (req, res) => {
  if (req.params.id === currentUser(req).id) throw new HttpError(400, 'You cannot delete your own account');
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, _count: { select: { teaching: true } } },
  });
  if (!target) throw new HttpError(404, 'User not found');
  if (target._count.teaching > 0) {
    throw new HttpError(409, 'This instructor still owns courses. Delete or reassign them first.');
  }
  await prisma.user.delete({ where: { id: target.id } });
  res.status(204).end();
});

adminRouter.post('/users/:id/enrollments', async (req, res) => {
  const { courseId } = enrollSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role !== 'STUDENT') throw new HttpError(400, 'Only students can be enrolled');
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new HttpError(404, 'Course not found');
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    create: { userId: user.id, courseId },
    update: {},
  });
  res.status(204).end();
});

adminRouter.delete('/users/:id/enrollments/:courseId', async (req, res) => {
  await prisma.enrollment.deleteMany({ where: { userId: req.params.id, courseId: req.params.courseId } });
  res.status(204).end();
});
