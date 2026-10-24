import { useState, type FormEvent } from 'react';
import type { QuestionInput, QuizInput } from '../types';

interface Props {
  initial?: QuizInput;
  locked?: boolean;
  submitting?: boolean;
  serverError?: string;
  onSubmit: (quiz: QuizInput) => void;
  onCancel: () => void;
}

const blankQuestion = (): QuestionInput => ({ prompt: '', options: ['', ''], correctIndex: 0 });

export function validateQuiz(quiz: QuizInput): string | null {
  if (quiz.title.trim().length < 2) return 'Give the quiz a title';
  if (quiz.questions.length === 0) return 'Add at least one question';
  for (const [i, q] of quiz.questions.entries()) {
    if (!q.prompt.trim()) return `Question ${i + 1} needs a prompt`;
    if (q.options.some((o) => !o.trim())) return `Fill in every option for question ${i + 1}`;
  }
  return null;
}

export default function QuizEditor({ initial, locked, submitting, serverError, onSubmit, onCancel }: Props) {
  const [quiz, setQuiz] = useState<QuizInput>(
    initial ?? { title: '', passMark: 70, maxAttempts: 3, questions: [blankQuestion()] },
  );
  const [error, setError] = useState<string | null>(null);

  const updateQuestion = (index: number, patch: Partial<QuestionInput>) =>
    setQuiz((q) => ({ ...q, questions: q.questions.map((qq, i) => (i === index ? { ...qq, ...patch } : qq)) }));

  function removeOption(qi: number, oi: number) {
    const q = quiz.questions[qi];
    const options = q.options.filter((_, i) => i !== oi);
    // Keep the correct answer pointing at the same option after removal
    const correctIndex = q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex;
    updateQuestion(qi, { options, correctIndex });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const message = validateQuiz(quiz);
    setError(message);
    if (!message) {
      // Pick fields explicitly: `initial` may be a stored quiz carrying ids and counts
      onSubmit({
        title: quiz.title.trim(),
        passMark: quiz.passMark,
        maxAttempts: quiz.maxAttempts,
        questions: quiz.questions.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((o) => o.trim()),
          correctIndex: q.correctIndex,
        })),
      });
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span>Quiz title</span>
        <input value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Pass mark (%)</span>
          <input type="number" min={0} max={100} value={quiz.passMark} onChange={(e) => setQuiz({ ...quiz, passMark: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Attempts allowed</span>
          <input type="number" min={1} max={10} value={quiz.maxAttempts} onChange={(e) => setQuiz({ ...quiz, maxAttempts: Number(e.target.value) })} />
        </label>
      </div>

      {locked && <p className="notice small">Students have attempted this quiz, so questions are locked. You can still change the title, pass mark and attempts.</p>}

      <fieldset className="questions" disabled={locked}>
        {quiz.questions.map((q, qi) => (
          <div key={qi} className="question-edit">
            <div className="row between">
              <strong>Question {qi + 1}</strong>
              {quiz.questions.length > 1 && (
                <button type="button" className="btn btn-small btn-danger" onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, i) => i !== qi) })}>
                  Remove
                </button>
              )}
            </div>
            <input aria-label={`Question ${qi + 1} prompt`} placeholder="Question prompt" value={q.prompt} onChange={(e) => updateQuestion(qi, { prompt: e.target.value })} />
            {q.options.map((option, oi) => (
              <div key={oi} className="option-row">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.correctIndex === oi}
                  onChange={() => updateQuestion(qi, { correctIndex: oi })}
                  aria-label={`Mark option ${oi + 1} of question ${qi + 1} as correct`}
                />
                <input
                  aria-label={`Question ${qi + 1} option ${oi + 1}`}
                  placeholder={`Option ${oi + 1}`}
                  value={option}
                  onChange={(e) => updateQuestion(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                />
                {q.options.length > 2 && (
                  <button type="button" className="btn btn-small btn-ghost" aria-label={`Remove option ${oi + 1}`} onClick={() => removeOption(qi, oi)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {q.options.length < 6 && (
              <button type="button" className="btn btn-small btn-ghost self-start" onClick={() => updateQuestion(qi, { options: [...q.options, ''] })}>
                + Add option
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-small self-start" onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion()] })}>
          + Add question
        </button>
      </fieldset>

      {(error || serverError) && <p className="error" role="alert">{error ?? serverError}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save quiz'}
        </button>
      </div>
    </form>
  );
}
