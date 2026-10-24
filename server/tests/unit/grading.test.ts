import { describe, expect, it } from 'vitest';
import { courseGrade, formatStudentNumber, gradeQuiz, progressPercent } from '../../src/lib/grading.js';

describe('gradeQuiz', () => {
  const questions = [{ correctIndex: 0 }, { correctIndex: 2 }, { correctIndex: 1 }];

  it('scores answers and reports per-question correctness', () => {
    expect(gradeQuiz(questions, [0, 1, 1])).toEqual({ correct: 2, total: 3, percent: 67, results: [true, false, true] });
  });

  it('handles a perfect and an empty score', () => {
    expect(gradeQuiz(questions, [0, 2, 1]).percent).toBe(100);
    expect(gradeQuiz(questions, [3, 3, 3]).percent).toBe(0);
  });
});

describe('progressPercent', () => {
  it('weights lessons, assignments and quizzes equally', () => {
    expect(
      progressPercent({ lessonsTotal: 6, lessonsDone: 3, assignmentsTotal: 2, assignmentsSubmitted: 1, quizzesTotal: 2, quizzesPassed: 0 }),
    ).toBe(40);
  });

  it('is 0 for an empty course rather than dividing by zero', () => {
    expect(
      progressPercent({ lessonsTotal: 0, lessonsDone: 0, assignmentsTotal: 0, assignmentsSubmitted: 0, quizzesTotal: 0, quizzesPassed: 0 }),
    ).toBe(0);
  });
});

describe('courseGrade', () => {
  it('averages graded assignments and best quiz scores', () => {
    expect(courseGrade([{ maxPoints: 50, grade: 40 }, { maxPoints: 100, grade: null }], [{ bestPercent: 60 }])).toBe(70);
  });

  it('returns null until something has been graded', () => {
    expect(courseGrade([{ maxPoints: 10, grade: null }], [{ bestPercent: null }])).toBeNull();
  });
});

describe('formatStudentNumber', () => {
  it('pads the sequence', () => {
    expect(formatStudentNumber(2026, 42)).toBe('S2026-0042');
  });
});
