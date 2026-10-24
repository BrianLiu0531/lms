import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import ProgressBar from '../../components/ProgressBar';
import QuizEditor from '../../components/QuizEditor';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatDateTime, toLocalInput } from '../../lib/format';
import { useInvalidate } from '../../lib/queries';
import type { BuilderCourse, BuilderLesson, QuizInput, RosterEntry } from '../../types';

type Tab = 'content' | 'assessments' | 'students' | 'settings';
type Editing =
  | { kind: 'lesson'; moduleId: string; lesson?: BuilderLesson }
  | { kind: 'assignment'; assignment?: BuilderCourse['assignments'][number] }
  | { kind: 'quiz'; quiz?: BuilderCourse['quizzes'][number] }
  | null;

export default function CourseBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const invalidate = useInvalidate();
  const [tab, setTab] = useState<Tab>('content');
  const [editing, setEditing] = useState<Editing>(null);

  const { data: course } = useQuery({ queryKey: ['builder', id], queryFn: () => api<BuilderCourse>(`/teach/courses/${id}`) });

  // One mutation for every builder write keeps loading and error handling consistent
  const write = useMutation({
    mutationFn: ({ path, method, json }: { path: string; method: string; json?: unknown }) => api(path, { method, json }),
    onSuccess: async () => {
      setEditing(null);
      await invalidate('builder', 'teach-courses', 'course', 'roster');
    },
  });
  const run = (path: string, method: string, json?: unknown) => write.mutate({ path, method, json });

  if (!course) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <Link to="/teach" className="muted small">
            ← Courses
          </Link>
          <h1>
            <span className="code">{course.code}</span> {course.title}
          </h1>
          <p className="muted small">
            {course.instructor.name} · {course._count.enrollments} students ·{' '}
            <span className={`tag ${course.published ? 'tag-ok' : ''}`}>{course.published ? 'Published' : 'Draft'}</span>
          </p>
        </div>
        <div className="row">
          <Link className="btn" to={`/courses/${course.id}`}>
            Preview
          </Link>
          <button
            className={`btn ${course.published ? '' : 'btn-primary'}`}
            disabled={write.isPending}
            onClick={() => run(`/teach/courses/${course.id}`, 'PUT', { code: course.code, title: course.title, summary: course.summary, published: !course.published })}
          >
            {course.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {write.error && !editing && <p className="error" role="alert">{errorMessage(write.error)}</p>}

      <div className="tabs" role="tablist">
        {(['content', 'assessments', 'students', 'settings'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'content' && <ContentTab course={course} run={run} busy={write.isPending} onEdit={setEditing} />}
      {tab === 'assessments' && <AssessmentsTab course={course} run={run} onEdit={setEditing} />}
      {tab === 'students' && <StudentsTab courseId={course.id} />}
      {tab === 'settings' && <SettingsTab course={course} />}

      {editing?.kind === 'lesson' && (
        <Modal title={editing.lesson ? 'Edit lesson' : 'New lesson'} onClose={() => setEditing(null)}>
          <LessonForm
            initial={editing.lesson}
            error={errorMessage(write.error)}
            busy={write.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(v) =>
              editing.lesson ? run(`/teach/lessons/${editing.lesson.id}`, 'PUT', v) : run(`/teach/modules/${editing.moduleId}/lessons`, 'POST', v)
            }
          />
        </Modal>
      )}
      {editing?.kind === 'assignment' && (
        <Modal title={editing.assignment ? 'Edit assignment' : 'New assignment'} onClose={() => setEditing(null)}>
          <AssignmentForm
            initial={editing.assignment}
            error={errorMessage(write.error)}
            busy={write.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(v) =>
              editing.assignment ? run(`/teach/assignments/${editing.assignment.id}`, 'PUT', v) : run(`/teach/courses/${course.id}/assignments`, 'POST', v)
            }
          />
        </Modal>
      )}
      {editing?.kind === 'quiz' && (
        <Modal title={editing.quiz ? 'Edit quiz' : 'New quiz'} onClose={() => setEditing(null)}>
          <QuizEditor
            initial={editing.quiz}
            locked={!!editing.quiz && editing.quiz._count.attempts > 0}
            submitting={write.isPending}
            serverError={errorMessage(write.error)}
            onCancel={() => setEditing(null)}
            onSubmit={(quiz: QuizInput) =>
              editing.quiz ? run(`/teach/quizzes/${editing.quiz.id}`, 'PUT', quiz) : run(`/teach/courses/${course.id}/quizzes`, 'POST', quiz)
            }
          />
        </Modal>
      )}
    </div>
  );
}

type Run = (path: string, method: string, json?: unknown) => void;

function ContentTab({ course, run, busy, onEdit }: { course: BuilderCourse; run: Run; busy: boolean; onEdit: (e: Editing) => void }) {
  const [moduleTitle, setModuleTitle] = useState('');
  return (
    <div className="stack">
      {course.modules.length === 0 && <p className="muted">Start by adding a module, then add lessons to it.</p>}
      {course.modules.map((m, mi) => (
        <div key={m.id} className="card stack">
          <div className="row between">
            <h2>
              Module {mi + 1}: {m.title}
            </h2>
            <div className="row">
              <button
                className="btn btn-small"
                onClick={() => {
                  const title = prompt('Module title', m.title);
                  if (title?.trim()) run(`/teach/modules/${m.id}`, 'PUT', { title: title.trim() });
                }}
              >
                Rename
              </button>
              <button
                className="btn btn-small btn-danger"
                onClick={() => confirm(`Delete “${m.title}” and its ${m.lessons.length} lessons?`) && run(`/teach/modules/${m.id}`, 'DELETE')}
              >
                Delete
              </button>
            </div>
          </div>
          <ol className="lesson-list">
            {m.lessons.map((l) => (
              <li key={l.id}>
                <span className="check" />
                <span>{l.title}</span>
                <span className="row">
                  <span className="muted small">{l.minutes} min</span>
                  <button className="btn btn-small" onClick={() => onEdit({ kind: 'lesson', moduleId: m.id, lesson: l })}>
                    Edit
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => confirm(`Delete “${l.title}”?`) && run(`/teach/lessons/${l.id}`, 'DELETE')}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <button className="btn btn-small self-start" onClick={() => onEdit({ kind: 'lesson', moduleId: m.id })}>
            + Add lesson
          </button>
        </div>
      ))}
      <form
        className="card row"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          run(`/teach/courses/${course.id}/modules`, 'POST', { title: moduleTitle });
          setModuleTitle('');
        }}
      >
        <input placeholder="New module title, e.g. Week 1 — Foundations" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} aria-label="New module title" className="grow" />
        <button className="btn btn-primary" disabled={busy || moduleTitle.trim().length < 2}>
          Add module
        </button>
      </form>
    </div>
  );
}

function AssessmentsTab({ course, run, onEdit }: { course: BuilderCourse; run: Run; onEdit: (e: Editing) => void }) {
  return (
    <div className="grid-2">
      <div className="card stack">
        <div className="row between">
          <h2>Assignments</h2>
          <button className="btn btn-small btn-primary" onClick={() => onEdit({ kind: 'assignment' })}>
            + New
          </button>
        </div>
        {course.assignments.length === 0 && <p className="muted small">No assignments yet.</p>}
        <ul className="plain-list">
          {course.assignments.map((a) => (
            <li key={a.id}>
              <div className="row between">
                <Link to={`/teach/assignments/${a.id}`}>
                  <strong>{a.title}</strong>
                </Link>
                <span className="row">
                  <button className="btn btn-small" onClick={() => onEdit({ kind: 'assignment', assignment: a })}>
                    Edit
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => confirm(`Delete “${a.title}” and all submissions?`) && run(`/teach/assignments/${a.id}`, 'DELETE')}>
                    Delete
                  </button>
                </span>
              </div>
              <span className="muted small">
                Due {formatDateTime(a.dueAt)} · {a.maxPoints} pts · <Link to={`/teach/assignments/${a.id}`}>{a._count.submissions} submissions</Link>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card stack">
        <div className="row between">
          <h2>Quizzes</h2>
          <button className="btn btn-small btn-primary" onClick={() => onEdit({ kind: 'quiz' })}>
            + New
          </button>
        </div>
        {course.quizzes.length === 0 && <p className="muted small">No quizzes yet.</p>}
        <ul className="plain-list">
          {course.quizzes.map((q) => (
            <li key={q.id}>
              <div className="row between">
                <strong>{q.title}</strong>
                <span className="row">
                  <button className="btn btn-small" onClick={() => onEdit({ kind: 'quiz', quiz: q })}>
                    Edit
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => confirm(`Delete “${q.title}” and all attempts?`) && run(`/teach/quizzes/${q.id}`, 'DELETE')}>
                    Delete
                  </button>
                </span>
              </div>
              <span className="muted small">
                {q.questions.length} questions · pass {q.passMark}% · {q.maxAttempts} attempts · {q._count.attempts} attempts taken
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StudentsTab({ courseId }: { courseId: string }) {
  const { data: roster } = useQuery({ queryKey: ['roster', courseId], queryFn: () => api<RosterEntry[]>(`/teach/courses/${courseId}/students`) });
  if (!roster) return <p className="muted">Loading…</p>;
  const avg = roster.length ? Math.round(roster.reduce((n, s) => n + s.progress.percent, 0) / roster.length) : 0;

  return (
    <div className="card table-card">
      <div className="table-toolbar">
        <span className="muted small">
          {roster.length} students enrolled · average progress {avg}%
        </span>
      </div>
      {roster.length === 0 ? (
        <p className="empty muted">No students enrolled yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Enrolled</th>
              <th>Progress</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id}>
                <td data-label="Student">
                  <strong>{s.name}</strong>
                  <div className="muted small">
                    {s.studentNumber} · {s.email}
                  </div>
                </td>
                <td data-label="Enrolled">{formatDate(s.enrolledAt)}</td>
                <td data-label="Progress" className="progress-cell">
                  <ProgressBar percent={s.progress.percent} label={`${s.name} progress`} />
                </td>
                <td data-label="Grade">{s.progress.grade === null ? <span className="muted">—</span> : `${s.progress.grade}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SettingsTab({ course }: { course: BuilderCourse }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [form, setForm] = useState({ code: course.code, title: course.title, summary: course.summary });
  const save = useMutation({
    mutationFn: () => api(`/teach/courses/${course.id}`, { method: 'PUT', json: { ...form, published: course.published } }),
    onSuccess: () => invalidate('builder', 'teach-courses'),
  });
  const remove = useMutation({
    mutationFn: () => api(`/teach/courses/${course.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidate('teach-courses');
      navigate('/teach');
    },
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    save.reset();
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  return (
    <div className="stack narrow-left">
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="field-row">
          <label className="field">
            <span>Course code</span>
            <input value={form.code} onChange={set('code')} />
          </label>
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={set('title')} />
          </label>
        </div>
        <label className="field">
          <span>Summary</span>
          <textarea rows={3} value={form.summary} onChange={set('summary')} />
        </label>
        {save.error && <p className="error">{errorMessage(save.error)}</p>}
        {save.isSuccess && <p className="success">Saved</p>}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={save.isPending}>
            Save details
          </button>
        </div>
      </form>
      <div className="card stack danger-zone">
        <h2>Delete course</h2>
        <p className="small muted">Only possible when no students are enrolled. This removes all modules, lessons and assessments.</p>
        {remove.error && <p className="error">{errorMessage(remove.error)}</p>}
        <button className="btn btn-danger self-start" disabled={remove.isPending} onClick={() => confirm(`Permanently delete ${course.code}?`) && remove.mutate()}>
          Delete {course.code}
        </button>
      </div>
    </div>
  );
}

function LessonForm({ initial, error, busy, onSubmit, onCancel }: {
  initial?: BuilderLesson;
  error?: string;
  busy: boolean;
  onSubmit: (v: { title: string; content: string; minutes: number }) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({ title: initial?.title ?? '', content: initial?.content ?? '', minutes: initial?.minutes ?? 10 });
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="field-row">
        <label className="field">
          <span>Title</span>
          <input required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </label>
        <label className="field">
          <span>Minutes</span>
          <input type="number" min={1} max={600} value={v.minutes} onChange={(e) => setV({ ...v, minutes: Number(e.target.value) })} />
        </label>
      </div>
      <label className="field">
        <span>Content (Markdown)</span>
        <textarea required rows={12} className="mono" value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Save lesson
        </button>
      </div>
    </form>
  );
}

function AssignmentForm({ initial, error, busy, onSubmit, onCancel }: {
  initial?: BuilderCourse['assignments'][number];
  error?: string;
  busy: boolean;
  onSubmit: (v: { title: string; instructions: string; dueAt: string; maxPoints: number }) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({
    title: initial?.title ?? '',
    instructions: initial?.instructions ?? '',
    dueAt: initial ? toLocalInput(initial.dueAt) : toLocalInput(new Date(Date.now() + 7 * 86_400_000).toISOString()),
    maxPoints: initial?.maxPoints ?? 100,
  });
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        // datetime-local has no zone; convert from the browser's local time to ISO
        onSubmit({ ...v, dueAt: new Date(v.dueAt).toISOString() });
      }}
    >
      <label className="field">
        <span>Title</span>
        <input required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Due</span>
          <input type="datetime-local" required value={v.dueAt} onChange={(e) => setV({ ...v, dueAt: e.target.value })} />
        </label>
        <label className="field">
          <span>Max points</span>
          <input type="number" min={1} max={1000} value={v.maxPoints} onChange={(e) => setV({ ...v, maxPoints: Number(e.target.value) })} />
        </label>
      </div>
      <label className="field">
        <span>Instructions (Markdown)</span>
        <textarea required rows={8} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Save assignment
        </button>
      </div>
    </form>
  );
}
