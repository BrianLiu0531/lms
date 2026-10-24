import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Markdown from '../../components/Markdown';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dueLabel, formatDateTime, gradeBand } from '../../lib/format';
import { useInvalidate } from '../../lib/queries';
import type { AssignmentView } from '../../types';

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<string | null>(null);

  const { data: a, error } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => api<AssignmentView>(`/learn/assignments/${id}`),
    retry: false,
  });

  const submit = useMutation({
    mutationFn: (content: string) => api(`/learn/assignments/${id}/submit`, { method: 'POST', json: { content } }),
    onSuccess: async () => {
      setDraft(null);
      await invalidate('assignment', 'course', 'dashboard');
    },
  });

  if (error instanceof ApiError && error.status === 403) return <p className="card empty">{error.message}.</p>;
  if (!a) return <p className="muted">Loading…</p>;

  const sub = a.submission;
  const graded = sub?.grade != null;
  const due = dueLabel(a.dueAt);
  const content = draft ?? sub?.content ?? '';

  return (
    <div className="stack narrow">
      <Link to={`/courses/${a.course.id}`} className="muted small">
        ← {a.course.code} {a.course.title}
      </Link>
      <div className="card stack">
        <h1>{a.title}</h1>
        <p className="muted small">
          {a.maxPoints} points · due {formatDateTime(a.dueAt)} · <span className={`due due-${due.tone}`}>{due.text}</span>
        </p>
        <Markdown>{a.instructions}</Markdown>
      </div>

      {graded && sub && (
        <div className="card stack grade-card">
          <h2>
            Your grade: {sub.grade}/{a.maxPoints}{' '}
            <span className="tag tag-ok">{gradeBand(Math.round((sub.grade! / a.maxPoints) * 100))}</span>
          </h2>
          {sub.feedback && <blockquote className="feedback">{sub.feedback}</blockquote>}
        </div>
      )}

      {user?.role === 'STUDENT' && (
        <form
          className="card form"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(content);
          }}
        >
          <h2>{sub ? 'Your submission' : 'Submit your work'}</h2>
          {sub && <p className="muted small">Last submitted {formatDateTime(sub.submittedAt)}</p>}
          <label className="field">
            <span>Answer or links (e.g. GitHub repository and live URL)</span>
            <textarea rows={6} value={content} readOnly={graded} onChange={(e) => setDraft(e.target.value)} />
          </label>
          {submit.error && <p className="error" role="alert">{errorMessage(submit.error)}</p>}
          {submit.isSuccess && <p className="success" role="status">Submitted ✓</p>}
          {!graded && (
            <div className="form-actions">
              <button className="btn btn-primary" disabled={submit.isPending || !content.trim()}>
                {submit.isPending ? 'Submitting…' : sub ? 'Resubmit' : 'Submit'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
