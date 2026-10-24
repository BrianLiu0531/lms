import { dueLabel, gradeBand } from './format';

describe('dueLabel', () => {
  const now = new Date('2026-03-10T12:00:00Z');
  const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();

  it.each([
    [5, 'Due within 24 hours', 'soon'],
    [30, 'Due tomorrow', 'soon'],
    [24 * 3 + 1, 'Due in 3 days', 'soon'],
    [24 * 10, 'Due in 10 days', 'later'],
    [-2, 'Overdue', 'overdue'],
    [-24 * 1 - 1, 'Overdue by 1 day', 'overdue'],
    [-24 * 4, 'Overdue by 4 days', 'overdue'],
  ])('%i hours from now → %s', (hours, text, tone) => {
    expect(dueLabel(at(hours), now)).toEqual({ text, tone });
  });
});

describe('gradeBand', () => {
  it.each([
    [92, 'Excellence'],
    [85, 'Excellence'],
    [72, 'Merit'],
    [50, 'Achieved'],
    [49, 'Not achieved'],
  ])('%i%% → %s', (pct, band) => {
    expect(gradeBand(pct)).toBe(band);
  });
});
