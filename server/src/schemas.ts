import { Role } from '@prisma/client';
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);
const name = z.string().trim().min(1).max(80);
const title = z.string().trim().min(2).max(150);
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const registerSchema = z.object({ name, email, password });
export const loginSchema = z.object({ email, password: z.string().min(1) });

export const courseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}\d{3,4}$/, 'Use a course code like WEB101'),
  title,
  summary: z.string().trim().min(10).max(1000),
});

export const courseUpdateSchema = courseSchema.extend({ published: z.boolean() });

export const moduleSchema = z.object({ title });

export const lessonSchema = z.object({
  title,
  content: z.string().trim().min(1).max(50_000),
  minutes: z.number().int().min(1).max(600).default(10),
});

export const assignmentSchema = z.object({
  title,
  instructions: z.string().trim().min(10).max(10_000),
  dueAt: z.coerce.date(),
  maxPoints: z.number().int().min(1).max(1000),
});

export const quizSchema = z.object({
  title,
  passMark: z.number().int().min(0).max(100).default(70),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  questions: z
    .array(
      z
        .object({
          prompt: z.string().trim().min(1).max(500),
          options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
          correctIndex: z.number().int().min(0),
        })
        .refine((q) => q.correctIndex < q.options.length, {
          message: 'Correct answer must be one of the options',
          path: ['correctIndex'],
        }),
    )
    .min(1, 'Add at least one question')
    .max(50),
});

export const submitSchema = z.object({ content: z.string().trim().min(1, 'Submission cannot be empty').max(20_000) });

export const attemptSchema = z.object({ answers: z.array(z.number().int().min(0)) });

export const gradeSchema = z.object({
  grade: z.number().int().min(0),
  feedback: z
    .string()
    .trim()
    .max(5000)
    .nullish()
    .transform((s) => s || null),
});

const studentNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^S\d{4}-\d{4}$/, 'Format: S2026-0001')
  .nullish()
  .transform((s) => s || null);

export const adminCreateUserSchema = z.object({ name, email, password, role: z.nativeEnum(Role), studentNumber });
export const adminUpdateUserSchema = z.object({ name, email, studentNumber });

export const adminUserQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  role: z.preprocess(emptyToUndefined, z.nativeEnum(Role).optional()),
  page: z.coerce.number().int().min(1).default(1),
});

export const enrollSchema = z.object({ courseId: z.string().min(1) });
