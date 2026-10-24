const DAY = 86_400_000;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Human-friendly due date, e.g. "Due tomorrow", "Due in 5 days", "Overdue by 2 days". */
export function dueLabel(iso: string, now = new Date()): { text: string; tone: 'overdue' | 'soon' | 'later' } {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms < 0) {
    const late = Math.floor(-ms / DAY);
    return { text: late < 1 ? 'Overdue' : `Overdue by ${late} day${late === 1 ? '' : 's'}`, tone: 'overdue' };
  }
  const days = Math.floor(ms / DAY);
  if (days < 1) return { text: 'Due within 24 hours', tone: 'soon' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon' };
  return { text: `Due in ${days} days`, tone: days <= 3 ? 'soon' : 'later' };
}

/** Value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function gradeBand(percent: number): string {
  // NZQA-style descriptors, common in NZ/AU tertiary feedback
  if (percent >= 85) return 'Excellence';
  if (percent >= 70) return 'Merit';
  if (percent >= 50) return 'Achieved';
  return 'Not achieved';
}
