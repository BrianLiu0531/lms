interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, total, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Prev
      </button>
      <span className="muted small">
        Page {page} of {pages}
      </span>
      <button className="btn btn-small" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next →
      </button>
    </div>
  );
}
