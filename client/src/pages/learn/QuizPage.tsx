import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { useInvalidate } from '../../lib/queries';
import type { AttemptResult, QuizView } from '../../types';

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);

  const { data: quiz, error } = useQuery({
    queryKey: ['quiz', id],
    queryFn: () => api<QuizView>(`/learn/quizzes/${id}`),
    retry: false,
  });

  const attempt = useMutation({
    mutationFn: (list: number[]) => api<AttemptResult>(`/learn/quizzes/${id}/attempts`, { method: 'POST', json: { answers: list } }),
    onSuccess: async (r) => {
      setResult(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await invalidate('quiz', 'course', 'dashboard');
    },
  });

  if (error instanceof ApiError && error.status === 403) return <p className="card empty">{error.message}.</p>;
  if (!quiz) return <p className="muted">Loading…</p>;

  const answeredAll = quiz.questions.every((_, i) => answers[i] !== undefined);
  const best = quiz.attempts.reduce((m, a) => Math.max(m, a.percent), 0);
  const canAttempt = user?.role === 'STUDENT' && quiz.attemptsLeft > 0;

  return (
    <div className="stack narrow">
      <Link to={`/courses/${quiz.course.id}`} className="muted small">
        ← {quiz.course.code} {quiz.course.title}
      </Link>
      <div className="card stack">
        <h1>{quiz.title}</h1>
        <p className="muted small">
          {quiz.questions.length} questions · pass mark {quiz.passMark}% · {quiz.attemptsLeft} of {quiz.maxAttempts} attempts left
          {quiz.attempts.length > 0 && ` · best score ${best}%`}
        </p>
      </div>

      {result && (
        <div className={`card result ${result.passed ? 'pass' : 'fail'}`} role="status">
          <h2>
            {result.passed ? '🎉 Passed' : 'Not quite'} — {result.correct}/{result.total} ({result.percent}%)
          </h2>
          <p className="small">
            {result.passed ? 'Great work! This quiz now counts towards your progress.' : `You need ${quiz.passMark}% to pass.`}
            {!result.passed && result.attemptsLeft > 0 && ` You have ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left.`}
          </p>
        </div>
      )}

      {canAttempt || result ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            attempt.mutate(quiz.questions.map((_, i) => answers[i]));
          }}
        >
          {quiz.questions.map((q, qi) => {
            const outcome = result?.results[qi];
            return (
              <fieldset key={q.id} className={`card question ${outcome === undefined ? '' : outcome ? 'correct' : 'incorrect'}`} disabled={!!result}>
                <legend>
                  {qi + 1}. {q.prompt}
                  {outcome !== undefined && <span className="sr-only">{outcome ? ' (correct)' : ' (incorrect)'}</span>}
                </legend>
                {q.options.map((o, oi) => (
                  <label key={oi} className="option">
                    <input type="radio" name={q.id} checked={answers[qi] === oi} onChange={() => setAnswers({ ...answers, [qi]: oi })} />
                    <span>{o}</span>
                  </label>
                ))}
              </fieldset>
            );
          })}
          {attempt.error && <p className="error" role="alert">{errorMessage(attempt.error)}</p>}
          {result ? (
            result.attemptsLeft > 0 &&
            !result.passed && (
              <button
                type="button"
                className="btn self-start"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
              >
                Try again
              </button>
            )
          ) : (
            <button className="btn btn-primary self-start" disabled={!answeredAll || attempt.isPending}>
              {attempt.isPending ? 'Marking…' : 'Submit answers'}
            </button>
          )}
        </form>
      ) : (
        user?.role === 'STUDENT' && <p className="card empty">You’ve used all your attempts for this quiz.</p>
      )}

      {quiz.attempts.length > 0 && (
        <div className="card stack">
          <h2>Previous attempts</h2>
          <ul className="plain-list">
            {quiz.attempts.map((a) => (
              <li key={a.id} className="row between">
                <span>
                  {a.correct}/{a.total} ({a.percent}%) {a.percent >= quiz.passMark ? '✓' : ''}
                </span>
                <span className="muted small">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
