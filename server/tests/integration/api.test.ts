import type { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';

const app = createApp();
const PASSWORD = 'password123';
let counter = 0;

type Agent = ReturnType<typeof request.agent> & { userId: string };

async function loginAs(role: Role): Promise<Agent> {
  const email = `${role.toLowerCase()}${++counter}@example.com`;
  const agent = request.agent(app);
  if (role === 'STUDENT') {
    const res = await agent.post('/api/auth/register').send({ name: `Student ${counter}`, email, password: PASSWORD }).expect(201);
    return Object.assign(agent, { userId: res.body.user.id as string });
  }
  const user = await prisma.user.create({
    data: { name: `${role} ${counter}`, email, role, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return Object.assign(agent, { userId: user.id });
}

/** Creates a published course with one lesson, one assignment and a two-question quiz. */
async function buildCourse(teacher: Agent, code = `WEB${100 + counter}`) {
  const course = (await teacher.post('/api/teach/courses').send({ code, title: 'Intro to Web', summary: 'Learn the basics of the web.' }).expect(201)).body;
  const mod = (await teacher.post(`/api/teach/courses/${course.id}/modules`).send({ title: 'Week 1' }).expect(201)).body;
  const lesson = (await teacher.post(`/api/teach/modules/${mod.id}/lessons`).send({ title: 'HTML', content: '# Hello', minutes: 5 }).expect(201)).body;
  const lesson2 = (await teacher.post(`/api/teach/modules/${mod.id}/lessons`).send({ title: 'CSS', content: '# Styles' }).expect(201)).body;
  const assignment = (
    await teacher
      .post(`/api/teach/courses/${course.id}/assignments`)
      .send({ title: 'Portfolio page', instructions: 'Build a single page portfolio.', dueAt: new Date(Date.now() + 86_400_000).toISOString(), maxPoints: 20 })
      .expect(201)
  ).body;
  const quiz = (
    await teacher
      .post(`/api/teach/courses/${course.id}/quizzes`)
      .send({
        title: 'Basics',
        passMark: 50,
        maxAttempts: 2,
        questions: [
          { prompt: '2 + 2?', options: ['3', '4'], correctIndex: 1 },
          { prompt: 'HTML stands for?', options: ['HyperText Markup Language', 'Hot Mail'], correctIndex: 0 },
        ],
      })
      .expect(201)
  ).body;
  await teacher.put(`/api/teach/courses/${course.id}`).send({ code, title: 'Intro to Web', summary: 'Learn the basics of the web.', published: true }).expect(200);
  return { course, lesson, lesson2, assignment, quiz };
}

beforeAll(async () => {
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth', () => {
  it('registers students with a sequential student number', async () => {
    const a = await request(app).post('/api/auth/register').send({ name: 'A', email: 'a@example.com', password: PASSWORD }).expect(201);
    const b = await request(app).post('/api/auth/register').send({ name: 'B', email: 'b@example.com', password: PASSWORD }).expect(201);
    expect(a.body.user).toMatchObject({ role: 'STUDENT', studentNumber: expect.stringMatching(/^S\d{4}-\d{4}$/) });
    expect(Number(b.body.user.studentNumber.slice(-4))).toBe(Number(a.body.user.studentNumber.slice(-4)) + 1);
  });

  it('ignores attempts to self-register as an instructor', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: PASSWORD, role: 'ADMIN' })
      .expect(201);
    expect(res.body.user.role).toBe('STUDENT');
  });

  it('enforces roles', async () => {
    const student = await loginAs('STUDENT');
    await student.post('/api/teach/courses').send({ code: 'ABC123', title: 'Nope', summary: 'Should be forbidden' }).expect(403);
    await student.get('/api/admin/users').expect(403);
    await request(app).get('/api/courses').expect(401);
  });
});

describe('course building', () => {
  it('refuses to publish a course without lessons', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    const course = (await teacher.post('/api/teach/courses').send({ code: 'EMP101', title: 'Empty', summary: 'Nothing here yet.' }).expect(201)).body;
    await teacher.put(`/api/teach/courses/${course.id}`).send({ code: 'EMP101', title: 'Empty', summary: 'Nothing here yet.', published: true }).expect(409);
  });

  it('validates course codes and quiz answers', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    await teacher.post('/api/teach/courses').send({ code: 'web', title: 'Bad code', summary: 'Invalid course code' }).expect(400);
    const course = (await teacher.post('/api/teach/courses').send({ code: 'QZ101', title: 'Quiz test', summary: 'For quiz validation' }).expect(201)).body;
    const res = await teacher
      .post(`/api/teach/courses/${course.id}/quizzes`)
      .send({ title: 'Broken', questions: [{ prompt: 'Q', options: ['a', 'b'], correctIndex: 5 }] })
      .expect(400);
    expect(res.body.issues[0].path).toBe('questions.0.correctIndex');
  });

  it("stops instructors editing another instructor's course", async () => {
    const owner = await loginAs('INSTRUCTOR');
    const rival = await loginAs('INSTRUCTOR');
    const { course, lesson, quiz } = await buildCourse(owner);
    await rival.get(`/api/teach/courses/${course.id}`).expect(404);
    await rival.put(`/api/teach/lessons/${lesson.id}`).send({ title: 'Hacked', content: 'x' }).expect(404);
    await rival.delete(`/api/teach/quizzes/${quiz.id}`).expect(404);
  });

  it('hides drafts from the catalogue', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    const draft = (await teacher.post('/api/teach/courses').send({ code: 'DRF101', title: 'Draft', summary: 'Not published yet.' }).expect(201)).body;
    const student = await loginAs('STUDENT');
    const catalogue = await student.get('/api/courses').expect(200);
    expect(catalogue.body.map((c: { id: string }) => c.id)).not.toContain(draft.id);
    await student.get(`/api/courses/${draft.id}`).expect(404);
  });
});

describe('learning', () => {
  it('requires enrolment before content can be viewed', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    const { course, lesson } = await buildCourse(teacher);
    const student = await loginAs('STUDENT');

    await student.get(`/api/learn/lessons/${lesson.id}`).expect(403);
    await student.post(`/api/courses/${course.id}/enroll`).expect(204);
    const res = await student.get(`/api/learn/lessons/${lesson.id}`).expect(200);
    expect(res.body).toMatchObject({ content: '# Hello', completed: false, prevLessonId: null, nextLessonId: expect.any(String) });
  });

  it('never exposes quiz answers to students', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    const { course, quiz } = await buildCourse(teacher);
    const student = await loginAs('STUDENT');
    await student.post(`/api/courses/${course.id}/enroll`).expect(204);

    const res = await student.get(`/api/learn/quizzes/${quiz.id}`).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('correctIndex');
    const attempt = await student.post(`/api/learn/quizzes/${quiz.id}/attempts`).send({ answers: [0, 0] }).expect(201);
    expect(attempt.body).toEqual({ id: expect.any(String), correct: 1, total: 2, percent: 50, results: [false, true], passed: true, attemptsLeft: 1 });
  });

  it('limits quiz attempts and validates answers', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    const { course, quiz } = await buildCourse(teacher);
    const student = await loginAs('STUDENT');
    await student.post(`/api/courses/${course.id}/enroll`).expect(204);

    await student.post(`/api/learn/quizzes/${quiz.id}/attempts`).send({ answers: [1] }).expect(400);
    await student.post(`/api/learn/quizzes/${quiz.id}/attempts`).send({ answers: [1, 7] }).expect(400);
    await student.post(`/api/learn/quizzes/${quiz.id}/attempts`).send({ answers: [1, 1] }).expect(201);
    await student.post(`/api/learn/quizzes/${quiz.id}/attempts`).send({ answers: [1, 0] }).expect(201);
    await student.post(`/api/learn/quizzes/${quiz.id}/attempts`).send({ answers: [1, 0] }).expect(409);

    // Once attempted, the instructor can tweak settings but not the questions
    const base = { title: 'Basics', passMark: 60, maxAttempts: 3 };
    const sameQuestions = [
      { prompt: '2 + 2?', options: ['3', '4'], correctIndex: 1 },
      { prompt: 'HTML stands for?', options: ['HyperText Markup Language', 'Hot Mail'], correctIndex: 0 },
    ];
    await teacher.put(`/api/teach/quizzes/${quiz.id}`).send({ ...base, questions: sameQuestions }).expect(200);
    await teacher.put(`/api/teach/quizzes/${quiz.id}`).send({ ...base, questions: [{ prompt: 'New?', options: ['a', 'b'], correctIndex: 0 }] }).expect(409);
  });

  it('tracks progress through lessons, assignments and quizzes', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    const { course, lesson, lesson2, assignment, quiz } = await buildCourse(teacher);
    const student = await loginAs('STUDENT');
    await student.post(`/api/courses/${course.id}/enroll`).expect(204);

    await student.post(`/api/learn/lessons/${lesson.id}/complete`).expect(204);
    await student.post(`/api/learn/lessons/${lesson.id}/complete`).expect(204); // idempotent
    let detail = await student.get(`/api/courses/${course.id}`).expect(200);
    expect(detail.body.learner.progress.percent).toBe(25); // 1 of 4 items

    await student.post(`/api/learn/lessons/${lesson2.id}/complete`).expect(204);
    await student.post(`/api/learn/assignments/${assignment.id}/submit`).send({ content: 'https://github.com/me/portfolio' }).expect(201);
    await student.post(`/api/learn/quizzes/${quiz.id}/attempts`).send({ answers: [1, 0] }).expect(201);
    detail = await student.get(`/api/courses/${course.id}`).expect(200);
    expect(detail.body.learner.progress).toMatchObject({ percent: 100, grade: 100 });

    const dashboard = await student.get('/api/me/dashboard').expect(200);
    expect(dashboard.body.courses[0].progress.percent).toBe(100);
    expect(dashboard.body.upcoming).toHaveLength(0); // already submitted
  });
});

describe('grading', () => {
  it('lets the instructor grade, and locks the submission afterwards', async () => {
    const teacher = await loginAs('INSTRUCTOR');
    const { course, assignment } = await buildCourse(teacher);
    const student = await loginAs('STUDENT');
    await student.post(`/api/courses/${course.id}/enroll`).expect(204);

    const first = await student.post(`/api/learn/assignments/${assignment.id}/submit`).send({ content: 'v1' }).expect(201);
    await student.post(`/api/learn/assignments/${assignment.id}/submit`).send({ content: 'v2' }).expect(200);

    const list = await teacher.get(`/api/teach/assignments/${assignment.id}/submissions`).expect(200);
    expect(list.body.submissions).toHaveLength(1);
    expect(list.body.submissions[0]).toMatchObject({ content: 'v2', late: false, student: { id: student.userId } });

    await teacher.patch(`/api/teach/submissions/${first.body.id}`).send({ grade: 25 }).expect(400); // over max
    await teacher.patch(`/api/teach/submissions/${first.body.id}`).send({ grade: 15, feedback: 'Nice work' }).expect(200);
    await student.post(`/api/learn/assignments/${assignment.id}/submit`).send({ content: 'v3' }).expect(409);

    const mine = await student.get(`/api/learn/assignments/${assignment.id}`).expect(200);
    expect(mine.body.submission).toMatchObject({ grade: 15, feedback: 'Nice work' });

    const roster = await teacher.get(`/api/teach/courses/${course.id}/students`).expect(200);
    expect(roster.body[0].progress.grade).toBe(75);
  });
});

describe('admin student management', () => {
  it('creates, views, updates and deletes students', async () => {
    const admin = await loginAs('ADMIN');
    const created = await admin
      .post('/api/admin/users')
      .send({ name: 'New Student', email: 'new.student@example.com', password: PASSWORD, role: 'STUDENT' })
      .expect(201);
    expect(created.body.studentNumber).toMatch(/^S\d{4}-\d{4}$/);

    await admin.post('/api/admin/users').send({ name: 'Dup', email: 'new.student@example.com', password: PASSWORD, role: 'STUDENT' }).expect(409);

    const found = await admin.get('/api/admin/users?search=new.student').expect(200);
    expect(found.body.total).toBe(1);

    const updated = await admin
      .put(`/api/admin/users/${created.body.id}`)
      .send({ name: 'Renamed Student', email: 'renamed@example.com', studentNumber: 'S2020-9999' })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Renamed Student', studentNumber: 'S2020-9999' });

    await admin.delete(`/api/admin/users/${created.body.id}`).expect(204);
    await admin.get(`/api/admin/users/${created.body.id}`).expect(404);
  });

  it('enrols students and shows their progress', async () => {
    const admin = await loginAs('ADMIN');
    const teacher = await loginAs('INSTRUCTOR');
    const { course } = await buildCourse(teacher);
    const student = await loginAs('STUDENT');

    await admin.post(`/api/admin/users/${student.userId}/enrollments`).send({ courseId: course.id }).expect(204);
    await admin.post(`/api/admin/users/${teacher.userId}/enrollments`).send({ courseId: course.id }).expect(400);
    const detail = await admin.get(`/api/admin/users/${student.userId}`).expect(200);
    expect(detail.body.enrollments[0]).toMatchObject({ course: { id: course.id }, progress: { percent: 0 } });

    await admin.delete(`/api/admin/users/${student.userId}/enrollments/${course.id}`).expect(204);
    expect((await admin.get(`/api/admin/users/${student.userId}`)).body.enrollments).toHaveLength(0);
  });

  it('protects instructors who still own courses and the admin themself', async () => {
    const admin = await loginAs('ADMIN');
    const teacher = await loginAs('INSTRUCTOR');
    await buildCourse(teacher);
    await admin.delete(`/api/admin/users/${teacher.userId}`).expect(409);
    await admin.delete(`/api/admin/users/${admin.userId}`).expect(400);
  });
});
