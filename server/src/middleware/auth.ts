import type { Role } from '@prisma/client';
import type { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../lib/http.js';

export const AUTH_COOKIE = 'token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function setAuthCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax' });
}

/** Role is read from the database (not trusted from the token) so changes apply immediately. */
async function resolveUser(req: Request): Promise<AuthUser | null> {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || !payload.sub) return null;
    return await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } });
  } catch {
    return null;
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return async (req, _res, next) => {
    const user = await resolveUser(req);
    if (!user) throw new HttpError(401, 'Not authenticated');
    if (roles.length > 0 && !roles.includes(user.role)) {
      throw new HttpError(403, 'You do not have access to this resource');
    }
    req.user = user;
    next();
  };
}

export const requireAuth = requireRole();

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}
