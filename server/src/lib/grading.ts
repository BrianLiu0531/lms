/** Pure grading and progress rules — no database access, fully unit tested. */

export interface QuizResult {
  correct: number;
  total: number;
  percent: number;
  /** Per-question correctness. Correct answers themselves are never revealed. */
  results: boolean[];
}

export function gradeQuiz(questions: { correctIndex: number }[], answers: number[]): QuizResult {
  const results = questions.map((q, i) => answers[i] === q.correctIndex);
  const correct = results.filter(Boolean).length;
  const total = questions.length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100), results };
}

export interface ProgressCounts {
  lessonsTotal: number;
  lessonsDone: number;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  quizzesTotal: number;
  quizzesPassed: number;
}

/** Every lesson, assignment and quiz counts as one item of equal weight. */
export function progressPercent(c: ProgressCounts): number {
  const total = c.lessonsTotal + c.assignmentsTotal + c.quizzesTotal;
  if (total === 0) return 0;
  const done = c.lessonsDone + c.assignmentsSubmitted + c.quizzesPassed;
  return Math.round((done / total) * 100);
}

/**
 * Current course grade: the average percentage across graded assignments and
 * attempted quizzes (best attempt). Returns null until something has been graded.
 */
export function courseGrade(
  assignments: { maxPoints: number; grade: number | null }[],
  quizzes: { bestPercent: number | null }[],
): number | null {
  const scores = [
    ...assignments.filter((a) => a.grade !== null).map((a) => (a.grade! / a.maxPoints) * 100),
    ...quizzes.filter((q) => q.bestPercent !== null).map((q) => q.bestPercent!),
  ];
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function formatStudentNumber(year: number, sequence: number): string {
  return `S${year}-${String(sequence).padStart(4, '0')}`;
}
