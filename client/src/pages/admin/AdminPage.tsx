import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { api, errorMessage, toQuery } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { AdminStats, AdminUserRow, Paged, Role } from '../../types';

const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Student', INSTRUCTOR: 'Instructor', ADMIN: 'Admin' };

export default function AdminPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState<'' | Role>('STUDENT');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<AdminStats>('/admin/stats') });
  const { data } = useQuery({
    queryKey: ['admin-users', debounced, role, page],
    queryFn: () => api<Paged<AdminUserRow>>(`/admin/users${toQuery({ search: debounced, role, page })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Students &amp; staff</h1>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Add user
        </button>
      </div>

      {stats && (
        <section className="kpis">
          <Kpi label="Students" value={stats.users.STUDENT ?? 0} />
          <Kpi label="Instructors" value={stats.users.INSTRUCTOR ?? 0} />
          <Kpi label="Courses (published / draft)" value={`${stats.courses.published} / ${stats.courses.drafts}`} />
          <Kpi label="Enrolments" value={stats.enrollments} />
          <Kpi label="Submissions to grade" value={stats.ungraded} />
        </section>
      )}

      <div className="card table-card">
        <div className="table-toolbar">
          <input placeholder="Search name, email or student number…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" className="grow" />
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as '' | Role);
              setPage(1);
            }}
            aria-label="Role"
          >
            <option value="">All roles</option>
            <option value="STUDENT">Students</option>
            <option value="INSTRUCTOR">Instructors</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>
        {data?.items.length === 0 && <p className="empty muted">No users found.</p>}
        {data && data.items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Student no.</th>
                <th>Role</th>
                <th>Courses</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name">
                    <Link to={`/admin/users/${u.id}`}>
                      <strong>{u.name}</strong>
                    </Link>
                    <div className="muted small">{u.email}</div>
                  </td>
                  <td data-label="Student no.">{u.studentNumber ?? <span className="muted">—</span>}</td>
                  <td data-label="Role">
                    <span className="tag">{ROLE_LABEL[u.role]}</span>
                  </td>
                  <td data-label="Courses">{u.role === 'INSTRUCTOR' ? `${u._count.teaching} teaching` : u.role === 'STUDENT' ? `${u._count.enrollments} enrolled` : '—'}</td>
                  <td data-label="Joined">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>

      {adding && <AddUserModal onClose={() => setAdding(false)} onCreated={(id) => navigate(`/admin/users/${id}`)} />}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card kpi">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT' as Role, studentNumber: '' });
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/admin/users', { method: 'POST', json: form }),
    onSuccess: (u) => onCreated(u.id),
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Modal title="Add user" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="field-row">
          <label className="field">
            <span>Full name</span>
            <input required value={form.name} onChange={set('name')} />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={form.role} onChange={set('role')}>
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set('email')} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Temporary password</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </label>
          {form.role === 'STUDENT' && (
            <label className="field">
              <span>Student number</span>
              <input placeholder="Auto-assigned if blank" value={form.studentNumber} onChange={set('studentNumber')} />
            </label>
          )}
        </div>
        {create.error && <p className="error" role="alert">{errorMessage(create.error)}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={create.isPending}>
            Create user
          </button>
        </div>
      </form>
    </Modal>
  );
}
