import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { Role } from '../types';

const NAV: Record<Role, { to: string; label: string; end?: boolean }[]> = {
  STUDENT: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/courses', label: 'Course catalogue' },
  ],
  INSTRUCTOR: [
    { to: '/teach', label: 'My courses' },
    { to: '/courses', label: 'Catalogue' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Students & staff' },
    { to: '/teach', label: 'All courses' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          🌿 Kura
        </Link>
        <nav className="nav">
          {NAV[user.role].map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-user">
          <span className="muted small">
            {user.name}
            {user.studentNumber && ` · ${user.studentNumber}`}
          </span>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
