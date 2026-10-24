import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { TeachCourseSummary } from '../../types';

export default function TeachCoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', title: '', summary: '' });
  const { data: courses, isLoading } = useQuery({ queryKey: ['teach-courses'], queryFn: () => api<TeachCourseSummary[]>('/teach/courses') });

  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/teach/courses', { method: 'POST', json: form }),
    onSuccess: (course) => navigate(`/teach/courses/${course.id}`),
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{isAdmin ? 'All courses' : 'My courses'}</h1>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + New course
          </button>
        )}
      </div>

      <div className="card table-card">
        {isLoading && <p className="muted">Loading…</p>}
        {courses?.length === 0 && <p className="empty muted">No courses yet — create your first one.</p>}
        {courses && courses.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                {isAdmin && <th>Instructor</th>}
                <th>Students</th>
                <th>Assessments</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td data-label="Course">
                    <Link to={`/teach/courses/${c.id}`}>
                      <span className="code">{c.code}</span> <strong>{c.title}</strong>
                    </Link>
                  </td>
                  {isAdmin && <td data-label="Instructor">{c.instructor.name}</td>}
                  <td data-label="Students">{c._count.enrollments}</td>
                  <td data-label="Assessments">
                    {c._count.assignments} assignments · {c._count.quizzes} quizzes
                  </td>
                  <td data-label="Status">
                    <span className={`tag ${c.published ? 'tag-ok' : ''}`}>{c.published ? 'Published' : 'Draft'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <Modal title="New course" onClose={() => setCreating(false)}>
          <form
            className="form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="field-row">
              <label className="field">
                <span>Course code</span>
                <input required placeholder="WEB101" value={form.code} onChange={set('code')} />
              </label>
              <label className="field">
                <span>Title</span>
                <input required value={form.title} onChange={set('title')} />
              </label>
            </div>
            <label className="field">
              <span>Summary</span>
              <textarea required rows={3} value={form.summary} onChange={set('summary')} />
            </label>
            {create.error && <p className="error" role="alert">{errorMessage(create.error)}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={create.isPending}>
                Create draft
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
