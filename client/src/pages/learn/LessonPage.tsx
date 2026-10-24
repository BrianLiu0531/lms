import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Markdown from '../../components/Markdown';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useInvalidate } from '../../lib/queries';
import type { LessonView } from '../../types';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: lesson, error } = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => api<LessonView>(`/learn/lessons/${id}`),
    retry: false,
  });

  const toggle = useMutation({
    mutationFn: (complete: boolean) => api(`/learn/lessons/${id}/complete`, { method: complete ? 'POST' : 'DELETE' }),
    onSuccess: async (_d, complete) => {
      await invalidate('lesson', 'course', 'dashboard');
      if (complete && lesson?.nextLessonId) navigate(`/lessons/${lesson.nextLessonId}`);
    },
  });

  if (error instanceof ApiError && error.status === 403) {
    return <p className="card empty">{error.message}.</p>;
  }
  if (!lesson) return <p className="muted">Loading…</p>;

  return (
    <article className="lesson stack">
      <div className="row between">
        <Link to={`/courses/${lesson.courseId}`} className="muted small">
          ← Back to course
        </Link>
        <span className="muted small">
          {lesson.module.title} · {lesson.minutes} min read
        </span>
      </div>
      <div className="card">
        <Markdown>{lesson.content}</Markdown>
      </div>
      {toggle.error && <p className="error">{errorMessage(toggle.error)}</p>}
      <div className="lesson-nav">
        {lesson.prevLessonId ? (
          <Link className="btn" to={`/lessons/${lesson.prevLessonId}`}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {user?.role === 'STUDENT' &&
          (lesson.completed ? (
            <button className="btn" disabled={toggle.isPending} onClick={() => toggle.mutate(false)}>
              ✓ Completed — undo
            </button>
          ) : (
            <button className="btn btn-primary" disabled={toggle.isPending} onClick={() => toggle.mutate(true)}>
              Mark complete{lesson.nextLessonId ? ' & continue' : ''}
            </button>
          ))}
        {lesson.nextLessonId ? (
          <Link className="btn" to={`/lessons/${lesson.nextLessonId}`}>
            Next →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </article>
  );
}
