import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import ProgressBar from '../../components/ProgressBar';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dueLabel, formatDate, gradeBand } from '../../lib/format';
import type { Dashboard } from '../../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/me/dashboard') });

  return (
    <div className="stack">
      <div>
        <h1>Kia ora, {user?.name.split(' ')[0]} 👋</h1>
        <p className="muted">Here’s where you’re up to.</p>
      </div>
      {isLoading && <p className="muted">Loading…</p>}

      {data && (
        <div className="dashboard-grid">
          <section className="stack">
            <h2>My courses</h2>
            {data.courses.length === 0 && (
              <div className="card empty">
                <p>You’re not enrolled in any courses yet.</p>
                <Link to="/courses">Browse the catalogue →</Link>
              </div>
            )}
            {data.courses.map((c) => (
              <Link key={c.id} to={`/courses/${c.id}`} className="card course-card link-card">
                <span className="code">{c.code}</span>
                <h3>{c.title}</h3>
                <p className="muted small">{c.instructor.name}</p>
                <ProgressBar percent={c.progress.percent} label={`${c.code} progress`} />
                <p className="muted small">
                  {c.progress.lessonsDone}/{c.progress.lessonsTotal} lessons · {c.progress.assignmentsSubmitted}/{c.progress.assignmentsTotal} assignments ·{' '}
                  {c.progress.quizzesPassed}/{c.progress.quizzesTotal} quizzes passed
                  {c.progress.grade !== null && ` · grade ${c.progress.grade}%`}
                </p>
              </Link>
            ))}
          </section>

          <aside className="stack">
            <div className="card stack">
              <h2>Upcoming deadlines</h2>
              {data.upcoming.length === 0 && <p className="muted small">Nothing due — nice work!</p>}
              <ul className="plain-list">
                {data.upcoming.map((a) => {
                  const due = dueLabel(a.dueAt);
                  return (
                    <li key={a.id}>
                      <Link to={`/assignments/${a.id}`}>{a.title}</Link>
                      <span className="muted small">
                        {a.course.code} · <span className={`due due-${due.tone}`}>{due.text}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="card stack">
              <h2>Recent grades</h2>
              {data.recentGrades.length === 0 && <p className="muted small">No graded work yet.</p>}
              <ul className="plain-list">
                {data.recentGrades.map((g) => {
                  const pct = Math.round((g.grade / g.assignment.maxPoints) * 100);
                  return (
                    <li key={g.id}>
                      <Link to={`/assignments/${g.assignment.id}`}>{g.assignment.title}</Link>
                      <span className="muted small">
                        {g.assignment.course.code} · {g.grade}/{g.assignment.maxPoints} ({gradeBand(pct)}) · {formatDate(g.gradedAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
