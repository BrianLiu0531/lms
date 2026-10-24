import { Prisma, type Role } from '@prisma/client';
import { prisma } from '../db.js';
import { formatStudentNumber } from './grading.js';

/**
 * Creates a user, assigning the next sequential student number for students.
 * Two concurrent sign-ups can race for the same number; the unique constraint
 * catches that and we retry with the next one.
 */
export async function createUserWithNumber(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  studentNumber?: string | null;
}) {
  if (data.role !== 'STUDENT' || data.studentNumber) {
    return prisma.user.create({ data: { ...data, studentNumber: data.role === 'STUDENT' ? data.studentNumber : null } });
  }

  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.user.count({ where: { studentNumber: { startsWith: `S${year}-` } } });
    try {
      return await prisma.user.create({
        data: { ...data, studentNumber: formatStudentNumber(year, count + 1 + attempt) },
      });
    } catch (e) {
      const target = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' ? e.meta?.target : null;
      if (!(Array.isArray(target) && target.includes('studentNumber'))) throw e;
    }
  }
  throw new Error('Could not allocate a student number');
}
