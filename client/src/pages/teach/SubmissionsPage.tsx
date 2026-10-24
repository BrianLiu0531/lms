import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useInvalidate } from '../../lib/queries';
import type { SubmissionsView } from '../../types';

type Row = SubmissionsView['submissions'][number];

export default function SubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useQuery({ queryKey: ['submissions', id], queryFn: () => api<SubmissionsView>(`/teach/assignments/${id}/submissions`) });
  if (!data) return <p className="muted">Loading…</p>;

  const { assignment, submissions, notSubmitted } = data;
  const ungraded = submissions.filter((s) => s.grade === null).length;

  return (
    <div className="stack narrow-wide">
      <Link to={`/teach/courses/${assignment.course.id}`} className="muted small">
        ← {assignment.course.code} {assignment.course.title}
      </Link>
      <div>
        <h1>{assignment.title}</h1>
        <p className="muted small">
          Due {formatDateTime(assignment.dueAt)} · {assignment.maxPoints} points · {submissions.length} submitted · {ungraded} to grade · {notSubmitted} not yet submitted
        </p>
      </div>
      {submissions.length === 0 && <p className="card empty">No submissions yet.</p>}
      {submissions.map((s) => (
        <GradeCard key={s.id} submission={s} maxPoints={assignment.maxPoints} />
      ))}
    </div>
  );
}

function GradeCard({ submission: s, maxPoints }: { submission: Row; maxPoints: number }) {
  const invalidate = useInvalidate();
  const [grade, setGrade] = useState(s.grade?.toString() ?? '');
  const [feedback, setFeedback] = useState(s.feedback ?? '');
  const save = useMutation({
    mutationFn: () => api(`/teach/submissions/${s.id}`, { method: 'PATCH', json: { grade: Number(grade), feedback } }),
    onSuccess: () => invalidate('submissions', 'builder', 'roster'),
  });

  const isLink = /^https?:\/\/\S+$/.test(s.content.trim());
  const valid = grade !== '' && Number(grade) >= 0 && Number(grade) <= maxPoints && Number.isInteger(Number(grade));

  return (
    <article className="card stack">
      <div className="row between">
        <div>
          <strong>{s.student.name}</strong> <span className="muted small">{s.student.studentNumber}</span>
        </div>
        <span className="row">
          {s.late && <span className="tag tag-warn">Late</span>}
          {s.grade !== null ? <span className="tag tag-ok">Graded {s.grade}/{maxPoints}</span> : <span className="tag">Needs grading</span>}
        </span>
      </div>
      <p className="muted small">Submitted {formatDateTime(s.submittedAt)}</p>
      <blockquote className="submission">
        {isLink ? (
          <a href={s.content.trim()} target="_blank" rel="noreferrer noopener">
            {s.content.trim()}
          </a>
        ) : (
          s.content
        )}
      </blockquote>
      <form
        className="grade-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="field">
          <span>Grade (out of {maxPoints})</span>
          <input type="number" min={0} max={maxPoints} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Feedback</span>
          <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={!valid || save.isPending}>
          {s.grade === null ? 'Save grade' : 'Update'}
        </button>
      </form>
      {save.error && <p className="error">{errorMessage(save.error)}</p>}
    </article>
  );
}
