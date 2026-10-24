import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ProgressBar from '../../components/ProgressBar';
import { api, ApiError, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useInvalidate } from '../../lib/queries';
import type { AdminUserDetail, TeachCourseSummary } from '../../types';

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: user, error } = useQuery({ queryKey: ['admin-user', id], queryFn: () => api<AdminUserDetail>(`/admin/users/${id}`), retry: false });
  const { data: courses } = useQuery({ queryKey: ['teach-courses'], queryFn: () => api<TeachCourseSummary[]>('/teach/courses') });

  const [form, setForm] = useState({ name: '', email: '', studentNumber: '' });
  const [courseId, setCourseId] = useState('');
  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email, studentNumber: user.studentNumber ?? '' });
  }, [user]);

  const refresh = () => invalidate('admin-user', 'admin-users', 'admin-stats', 'teach-courses');
  const save = useMutation({ mutationFn: () => api(`/admin/users/${id}`, { method: 'PUT', json: form }), onSuccess: refresh });
  const enrol = useMutation({
    mutationFn: (cid: string) => api(`/admin/users/${id}/enrollments`, { method: 'POST', json: { courseId: cid } }),
    onSuccess: async () => {
      setCourseId('');
      await refresh();
    },
  });
  const unenrol = useMutation({ mutationFn: (cid: string) => api(`/admin/users/${id}/enrollments/${cid}`, { method: 'DELETE' }), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: () => api(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await refresh();
      navigate('/admin');
    },
  });

  if (error instanceof ApiError && error.status === 404) return <p className="card empty">User not found.</p>;
  if (!user) return <p className="muted">Loading…</p>;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    save.reset();
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const enrolledIds = new Set(user.enrollments.map((e) => e.course.id));
  const available = courses?.filter((c) => !enrolledIds.has(c.id)) ?? [];

  return (
    <div className="stack narrow-wide">
      <Link to="/admin" className="muted small">
        ← Students &amp; staff
      </Link>
      <div>
        <h1>{user.name}</h1>
        <p className="muted small">
          {user.role.toLowerCase()} · {user.studentNumber ?? user.email} · joined {formatDate(user.createdAt)}
        </p>
      </div>

      <form
        className="card form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2>Details</h2>
        <div className="field-row">
          <label className="field">
            <span>Full name</span>
            <input required value={form.name} onChange={set('name')} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={form.email} onChange={set('email')} />
          </label>
        </div>
        {user.role === 'STUDENT' && (
          <label className="field">
            <span>Student number</span>
            <input value={form.studentNumber} onChange={set('studentNumber')} />
          </label>
        )}
        {save.error && <p className="error" role="alert">{errorMessage(save.error)}</p>}
        {save.isSuccess && <p className="success">Saved</p>}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={save.isPending}>
            Save changes
          </button>
        </div>
      </form>

      {user.role === 'STUDENT' && (
        <div className="card stack">
          <h2>Enrolments</h2>
          {user.enrollments.length === 0 && <p className="muted small">Not enrolled in any courses.</p>}
          <ul className="plain-list">
            {user.enrollments.map((e) => (
              <li key={e.course.id} className="enrolment-row">
                <div>
                  <Link to={`/courses/${e.course.id}`}>
                    <span className="code">{e.course.code}</span> {e.course.title}
                  </Link>
                  <div className="muted small">
                    Enrolled {formatDate(e.enrolledAt)}
                    {e.progress.grade !== null && ` · grade ${e.progress.grade}%`}
                  </div>
                </div>
                <ProgressBar percent={e.progress.percent} label={`${e.course.code} progress`} />
                <button className="btn btn-small btn-danger" disabled={unenrol.isPending} onClick={() => confirm(`Remove from ${e.course.code}?`) && unenrol.mutate(e.course.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (courseId) enrol.mutate(courseId);
            }}
          >
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course to enrol in" className="grow">
              <option value="">Enrol in a course…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                  {c.published ? '' : ' (draft)'}
                </option>
              ))}
            </select>
            <button className="btn" disabled={!courseId || enrol.isPending}>
              Enrol
            </button>
          </form>
          {(enrol.error || unenrol.error) && <p className="error">{errorMessage(enrol.error ?? unenrol.error)}</p>}
        </div>
      )}

      {user.role === 'INSTRUCTOR' && (
        <div className="card stack">
          <h2>Teaching</h2>
          {user.teaching.length === 0 && <p className="muted small">No courses.</p>}
          <ul className="plain-list">
            {user.teaching.map((c) => (
              <li key={c.id}>
                <Link to={`/teach/courses/${c.id}`}>
                  <span className="code">{c.code}</span> {c.title}
                </Link>
                <span className="muted small">{c.published ? 'Published' : 'Draft'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack danger-zone">
        <h2>Delete user</h2>
        <p className="small muted">Removes the account along with its enrolments, submissions and quiz attempts.</p>
        {remove.error && <p className="error">{errorMessage(remove.error)}</p>}
        <button className="btn btn-danger self-start" disabled={remove.isPending} onClick={() => confirm(`Permanently delete ${user.name}?`) && remove.mutate()}>
          Delete {user.name}
        </button>
      </div>
    </div>
  );
}
