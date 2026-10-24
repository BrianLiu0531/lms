import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { homeFor, useAuth } from './lib/auth';
import AdminPage from './pages/admin/AdminPage';
import AdminUserPage from './pages/admin/AdminUserPage';
import AuthPage from './pages/AuthPage';
import AssignmentPage from './pages/learn/AssignmentPage';
import CataloguePage from './pages/learn/CataloguePage';
import CoursePage from './pages/learn/CoursePage';
import DashboardPage from './pages/learn/DashboardPage';
import LessonPage from './pages/learn/LessonPage';
import QuizPage from './pages/learn/QuizPage';
import CourseBuilderPage from './pages/teach/CourseBuilderPage';
import SubmissionsPage from './pages/teach/SubmissionsPage';
import TeachCoursesPage from './pages/teach/TeachCoursesPage';
import type { Role } from './types';

const loading = <div className="page-loading">Loading…</div>;

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return loading;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  if (isLoading) return loading;
  return user ? <Navigate to={from ?? homeFor(user.role)} replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Guard roles={['STUDENT']}><DashboardPage /></Guard>} />
        <Route path="courses" element={<CataloguePage />} />
        <Route path="courses/:id" element={<CoursePage />} />
        <Route path="lessons/:id" element={<LessonPage />} />
        <Route path="assignments/:id" element={<AssignmentPage />} />
        <Route path="quizzes/:id" element={<QuizPage />} />

        <Route path="teach" element={<Guard roles={['INSTRUCTOR', 'ADMIN']}><TeachCoursesPage /></Guard>} />
        <Route path="teach/courses/:id" element={<Guard roles={['INSTRUCTOR', 'ADMIN']}><CourseBuilderPage /></Guard>} />
        <Route path="teach/assignments/:id" element={<Guard roles={['INSTRUCTOR', 'ADMIN']}><SubmissionsPage /></Guard>} />

        <Route path="admin" element={<Guard roles={['ADMIN']}><AdminPage /></Guard>} />
        <Route path="admin/users/:id" element={<Guard roles={['ADMIN']}><AdminUserPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
