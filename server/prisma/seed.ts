import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const hash = (pw: string) => bcrypt.hash(pw, 12);

const lesson = (title: string, minutes: number, body: string) => ({ title, minutes, content: `# ${title}\n\n${body.trim()}` });

const courses = [
  {
    code: 'WEB101',
    title: 'Modern Web Development with React',
    summary: 'Build fast, accessible web apps with HTML, CSS, JavaScript and React — from your first component to deployment.',
    published: true,
    modules: [
      {
        title: 'Web foundations',
        lessons: [
          lesson('How the web works', 12, `
When you type a URL, your browser asks a **DNS server** for the IP address, opens a connection and sends an **HTTP request**. The server replies with HTML, which the browser parses into the **DOM**.

## Key terms
- **Client** — the browser making requests
- **Server** — the computer responding
- **HTTP status codes** — \`200 OK\`, \`404 Not Found\`, \`500 Internal Server Error\`
`),
          lesson('Semantic, accessible HTML', 15, `
Use elements for their meaning, not their looks: \`<nav>\`, \`<main>\`, \`<button>\`. Screen readers rely on these.

> Australia's Disability Discrimination Act and NZ's Web Accessibility Standard both expect public websites to meet **WCAG 2.1 AA**.

\`\`\`html
<button type="submit">Save</button> <!-- not <div onclick> -->
\`\`\`
`),
        ],
      },
      {
        title: 'React fundamentals',
        lessons: [
          lesson('Components and props', 18, `
A component is a function that returns UI.

\`\`\`tsx
function Greeting({ name }: { name: string }) {
  return <p>Kia ora, {name}!</p>;
}
\`\`\`

Props flow **down** from parent to child and are read-only.
`),
          lesson('State and effects', 20, `
\`useState\` stores values that change over time; updating state re-renders the component.

\`\`\`tsx
const [count, setCount] = useState(0);
\`\`\`

Use \`useEffect\` only to sync with something *outside* React, such as a timer or a browser API.
`),
          lesson('Fetching data', 16, `
Server data has different needs from UI state: caching, refetching and loading states. Libraries like **TanStack Query** handle this for you.
`),
        ],
      },
    ],
    assignments: [
      { title: 'Build a responsive profile page', dueInDays: 7, maxPoints: 100, instructions: 'Create a single responsive page introducing yourself using semantic HTML and CSS. It must work on a 375px-wide phone screen. Submit a link to your GitHub repository and a live URL.' },
      { title: 'React to-do app', dueInDays: 21, maxPoints: 50, instructions: 'Build a to-do list in React with add, complete and delete. Store items in state. Submit your repository link and a short reflection on what you learned.' },
    ],
    quizzes: [
      {
        title: 'Web foundations check',
        passMark: 70,
        questions: [
          { prompt: 'Which HTTP status code means the resource was not found?', options: ['200', '301', '404', '500'], correctIndex: 2 },
          { prompt: 'Which element should you use for a clickable action?', options: ['<div>', '<span>', '<button>', '<a> without href'], correctIndex: 2 },
          { prompt: 'What does DNS translate?', options: ['HTML into the DOM', 'Domain names into IP addresses', 'JSON into objects', 'CSS into pixels'], correctIndex: 1 },
          { prompt: 'What WCAG level do AU and NZ government sites target?', options: ['A', 'AA', 'AAA', 'None'], correctIndex: 1 },
        ],
      },
    ],
  },
  {
    code: 'DATA110',
    title: 'SQL for Analysts',
    summary: 'Query, join and summarise data with PostgreSQL — the most requested skill in AU/NZ data analyst job ads.',
    published: true,
    modules: [
      {
        title: 'Querying data',
        lessons: [
          lesson('SELECT and WHERE', 14, 'Use `SELECT` to choose columns and `WHERE` to filter rows.\n\n```sql\nSELECT name, city FROM customers WHERE country = \'NZ\';\n```'),
          lesson('Aggregates and GROUP BY', 18, 'Summarise rows with `COUNT`, `SUM` and `AVG`, grouped by one or more columns.'),
          lesson('Joins', 22, 'An `INNER JOIN` returns rows that match in both tables; a `LEFT JOIN` keeps every row from the left table.'),
        ],
      },
    ],
    assignments: [
      { title: 'Sales report queries', dueInDays: 10, maxPoints: 40, instructions: 'Using the provided sample schema, write queries for: total sales by state, top 5 products, and monthly revenue for the last financial year.' },
    ],
    quizzes: [
      {
        title: 'SQL basics',
        passMark: 60,
        questions: [
          { prompt: 'Which clause filters rows before grouping?', options: ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], correctIndex: 1 },
          { prompt: 'Which join keeps all rows from the left table?', options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], correctIndex: 1 },
          { prompt: 'COUNT(*) returns…', options: ['The sum of a column', 'The number of rows', 'The largest value', 'Distinct values'], correctIndex: 1 },
        ],
      },
    ],
  },
  {
    code: 'CLD200',
    title: 'Cloud Fundamentals on AWS',
    summary: 'Core AWS services, the shared responsibility model and deploying a containerised app to the Sydney region.',
    published: false,
    modules: [{ title: 'Getting started', lessons: [lesson('Regions and availability zones', 10, 'AWS has regions in Sydney (`ap-southeast-2`), Melbourne (`ap-southeast-4`) and Auckland (`ap-southeast-6`).')] }],
    assignments: [],
    quizzes: [],
  },
];

async function main() {
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({ data: { name: 'Site Admin', email: 'admin@example.com', role: 'ADMIN', passwordHash: await hash('Admin1234!') } });
  const instructor = await prisma.user.create({
    data: { name: 'Dr Aroha Williams', email: 'instructor@example.com', role: 'INSTRUCTOR', passwordHash: await hash('Teach1234!') },
  });

  const year = new Date().getFullYear();
  const studentNames = ['Alex Chen', 'Mia Thompson', 'Tama Ngata', 'Priya Sharma', 'Liam O’Connor', 'Sophie Martin'];
  const students = [];
  for (const [i, name] of studentNames.entries()) {
    students.push(
      await prisma.user.create({
        data: {
          name,
          email: i === 0 ? 'student@example.com' : `${name.split(' ')[0].toLowerCase()}@example.com`,
          role: 'STUDENT',
          studentNumber: `S${year}-${String(i + 1).padStart(4, '0')}`,
          passwordHash: await hash('Student1234!'),
        },
      }),
    );
  }

  const now = Date.now();
  const created = [];
  for (const c of courses) {
    created.push(
      await prisma.course.create({
        data: {
          code: c.code,
          title: c.title,
          summary: c.summary,
          published: c.published,
          instructorId: instructor.id,
          modules: {
            create: c.modules.map((m, mi) => ({
              title: m.title,
              position: mi,
              lessons: { create: m.lessons.map((l, li) => ({ ...l, position: li })) },
            })),
          },
          assignments: {
            create: c.assignments.map(({ dueInDays, ...a }) => ({ ...a, dueAt: new Date(now + dueInDays * DAY) })),
          },
          quizzes: {
            create: c.quizzes.map(({ questions, ...q }) => ({
              ...q,
              questions: { create: questions.map((qq, position) => ({ ...qq, position })) },
            })),
          },
        },
        include: {
          modules: { include: { lessons: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
          assignments: true,
          quizzes: { include: { questions: { orderBy: { position: 'asc' } } } },
        },
      }),
    );
  }

  const [web, data] = created;
  const webLessons = web.modules.flatMap((m) => m.lessons);
  const dataLessons = data.modules.flatMap((m) => m.lessons);

  // Varied progress so dashboards and rosters look realistic
  for (const [i, s] of students.entries()) {
    await prisma.enrollment.create({ data: { userId: s.id, courseId: web.id, enrolledAt: new Date(now - (20 - i) * DAY) } });
    const done = webLessons.slice(0, Math.max(0, webLessons.length - i));
    await prisma.lessonCompletion.createMany({ data: done.map((l) => ({ userId: s.id, lessonId: l.id })) });
    if (i < 4) {
      await prisma.submission.create({
        data: {
          assignmentId: web.assignments.find((a) => a.maxPoints === 100)!.id,
          studentId: s.id,
          content: `https://github.com/example/${s.name.split(' ')[0].toLowerCase()}-profile`,
          submittedAt: new Date(now - (3 - (i % 3)) * DAY),
          ...(i < 2 ? { grade: 92 - i * 14, feedback: i === 0 ? 'Great semantic structure and very clean CSS. Consider adding focus styles.' : 'Solid work — check colour contrast on the header.', gradedAt: new Date(now - DAY) } : {}),
        },
      });
    }
    if (i < 5) {
      const quiz = web.quizzes[0];
      const answers = quiz.questions.map((q, qi) => (qi < 4 - (i % 3) ? q.correctIndex : (q.correctIndex + 1) % q.options.length));
      const correct = answers.filter((a, qi) => a === quiz.questions[qi].correctIndex).length;
      await prisma.quizAttempt.create({
        data: { quizId: quiz.id, studentId: s.id, answers, correct, total: answers.length, percent: Math.round((correct / answers.length) * 100) },
      });
    }
    if (i % 2 === 0) {
      await prisma.enrollment.create({ data: { userId: s.id, courseId: data.id } });
      await prisma.lessonCompletion.createMany({ data: dataLessons.slice(0, 1 + (i % 3)).map((l) => ({ userId: s.id, lessonId: l.id })) });
    }
  }

  console.log(`Seeded ${created.length} courses, ${students.length} students`);
  console.log('  admin@example.com / Admin1234!');
  console.log('  instructor@example.com / Teach1234!');
  console.log('  student@example.com / Student1234!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
