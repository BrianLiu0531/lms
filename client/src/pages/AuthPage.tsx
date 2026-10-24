import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';

const DEMOS = [
  { label: 'Student', email: 'student@example.com', password: 'Student1234!' },
  { label: 'Instructor', email: 'instructor@example.com', password: 'Teach1234!' },
  { label: 'Admin', email: 'admin@example.com', password: 'Admin1234!' },
];

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Redirecting after success is handled by the GuestOnly route guard
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => (mode === 'login' ? login(form.email, form.password) : register(form)));
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <h1>🌿 Kura</h1>
        <p className="muted">
          A learning management system for courses, assignments and quizzes. <em>Kura</em> means “school” in te reo Māori.
        </p>
      </div>
      <form className="card auth-card form" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create a student account'}</h2>
        {mode === 'register' && (
          <label className="field">
            <span>Full name</span>
            <input required autoComplete="name" value={form.name} onChange={set('name')} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={set('password')}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        {mode === 'login' ? (
          <>
            <div className="demo-box">
              <span className="muted small">Explore with a demo account</span>
              <div className="demo-buttons">
                {DEMOS.map((d) => (
                  <button key={d.label} type="button" className="btn btn-small" disabled={busy} onClick={() => run(() => login(d.email, d.password))}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted small center">
              New student? <Link to="/register">Create an account</Link>
            </p>
          </>
        ) : (
          <p className="muted small center">
            Already enrolled? <Link to="/login">Log in</Link>
          </p>
        )}
      </form>
    </div>
  );
}
