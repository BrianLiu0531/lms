import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import ProgressBar from '../../components/ProgressBar';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dueLabel, formatDate } from '../../lib/format';
import { useInvalidate } from '../../lib/queries';
import type { CourseOutline } from '../../types';

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api<CourseOutline>(`/courses/${id}`),
    retry: false,
  });

  const enrol = useMutation({
    mutationFn: (join: boolean) => api(`/courses/${id}/enroll`, { method: join ? 'POST' : 'DELETE' }),
    onSuccess: () => invalidate('course', 'catalogue', 'dashboard'),
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="card empty">Course not found.</p>;
  if (!course) return <p className="error">Couldn’t load this course.</p>;

  const learner = course.learner;
  const done = new Set(learner?.completedLessonIds);
  const canView = course.enrolled || course.canTeach;
  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const firstOpen = course.modules.flatMap((m) => m.lessons).find((l) => !done.has(l.id));

  return (
    <div className="course-layout">
      <section className="stack">
        <div className="card stack course-hero">
          <span className="code">{course.code}</span>
          <h1>{course.title}</h1>
          <p>{course.summary}</p>
          <p className="muted small">
            Taught by {course.instructor.name} · {lessonCount} lessons · {course.assignments.length} assignments · {course.quizzes.length} quizzes
            {!course.published && ' · draft'}
          </p>
          {learner && <ProgressBar percent={learner.progress.percent} label="Course progress" />}
          <div className="row">
            {user?.role === 'STUDENT' && !course.enrolled && (
              <button className="btn btn-primary" disabled={enrol.isPending} onClick={() => enrol.mutate(true)}>
                Enrol in this course
              </button>
            )}
            {course.enrolled && firstOpen && (
              <Link className="btn btn-primary" to={`/lessons/${firstOpen.id}`}>
                {done.size ? 'Continue learning' : 'Start course'} →
              </Link>
            )}
            {course.canTeach && (
              <Link className="btn" to={`/teach/courses/${course.id}`}>
                Edit course
              </Link>
            )}
          </div>
          {enrol.error && <p className="error">{errorMessage(enrol.error)}</p>}
        </div>

        {course.modules.map((m, mi) => (
          <div key={m.id} className="card stack">
            <h2>
              Module {mi + 1}: {m.title}
            </h2>
            <ol className="lesson-list">
              {m.lessons.map((l) => (
                <li key={l.id} className={done.has(l.id) ? 'done' : ''}>
                  <span className="check" aria-label={done.has(l.id) ? 'Completed' : 'Not completed'}>
                    {done.has(l.id) ? '✓' : ''}
                  </span>
                  {canView ? <Link to={`/lessons/${l.id}`}>{l.title}</Link> : <span>{l.title}</span>}
                  <span className="muted small">{l.minutes} min</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <aside className="stack">
        <div className="card stack">
          <h2>Assignments</h2>
          {course.assignments.length === 0 && <p className="muted small">No assignments.</p>}
          <ul className="plain-list">
            {course.assignments.map((a) => {
              const sub = learner?.submissions[a.id];
              const due = dueLabel(a.dueAt);
              return (
                <li key={a.id}>
                  {canView ? <Link to={`/assignments/${a.id}`}>{a.title}</Link> : a.title}
                  <span className="muted small">
                    {sub ? (
                      sub.grade !== null ? (
                        <>Graded {sub.grade}/{a.maxPoints}</>
                      ) : (
                        <>Submitted {formatDate(sub.submittedAt)}</>
                      )
                    ) : (
                      <span className={`due due-${due.tone}`}>{due.text}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card stack">
          <h2>Quizzes</h2>
          {course.quizzes.length === 0 && <p className="muted small">No quizzes.</p>}
          <ul className="plain-list">
            {course.quizzes.map((q) => {
              const mine = learner?.quizzes[q.id];
              return (
                <li key={q.id}>
                  {canView ? <Link to={`/quizzes/${q.id}`}>{q.title}</Link> : q.title}
                  <span className="muted small">
                    {q._count.questions} questions · pass {q.passMark}%
                    {mine && ` · best ${mine.best}%${(mine.best ?? 0) >= q.passMark ? ' ✓' : ''}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {course.enrolled && (
          <button className="btn btn-ghost btn-danger" disabled={enrol.isPending} onClick={() => confirm('Leave this course? Your progress will be kept.') && enrol.mutate(false)}>
            Leave course
          </button>
        )}
      </aside>
    </div>
  );
}
