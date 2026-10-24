export default function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <span className="small muted">{percent}%</span>
    </div>
  );
}
