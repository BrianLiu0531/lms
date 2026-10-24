import { prisma } from '../db.js';
import type { AuthUser } from '../middleware/auth.js';
import { HttpError } from './http.js';

/**
 * Course-level authorisation. Every content route resolves its parent course
 * and goes through one of these two checks, so the rules live in one place.
 */

export async function teachableCourse(user: AuthUser, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  // Admins can manage any course; instructors only their own. 404 avoids leaking IDs.
  if (!course || (user.role !== 'ADMIN' && course.instructorId !== user.id)) {
    throw new HttpError(404, 'Course not found');
  }
  return course;
}

export async function canTeach(user: AuthUser, courseId: string): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'INSTRUCTOR') return false;
  const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: user.id }, select: { id: true } });
  return !!course;
}

/** Learners must be enrolled in a published course; teachers of the course always have access. */
export async function assertCanLearn(user: AuthUser, courseId: string) {
  if (await canTeach(user, courseId)) return { asTeacher: true };
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    include: { course: { select: { published: true } } },
  });
  if (!enrollment || !enrollment.course.published) {
    throw new HttpError(403, 'Enrol in this course to access its content');
  }
  return { asTeacher: false };
}

export function assertStudent(user: AuthUser) {
  if (user.role !== 'STUDENT') throw new HttpError(403, 'Only students can do this');
}
