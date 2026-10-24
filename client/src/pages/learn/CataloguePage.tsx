import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { CatalogueCourse } from '../../types';

export default function CataloguePage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['catalogue'], queryFn: () => api<CatalogueCourse[]>('/courses') });

  const term = search.trim().toLowerCase();
  const courses = data?.filter((c) => !term || `${c.code} ${c.title} ${c.summary}`.toLowerCase().includes(term));

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Course catalogue</h1>
        <input className="search" placeholder="Search courses…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search courses" />
      </div>
      {isLoading && <p className="muted">Loading…</p>}
      {courses?.length === 0 && <p className="muted">No courses match “{search}”.</p>}
      <div className="card-grid">
        {courses?.map((c) => (
          <Link key={c.id} to={`/courses/${c.id}`} className="card course-card link-card">
            <div className="row between">
              <span className="code">{c.code}</span>
              {c.enrolled && <span className="tag tag-ok">Enrolled</span>}
            </div>
            <h3>{c.title}</h3>
            <p className="small">{c.summary}</p>
            <p className="muted small">
              {c.instructor.name} · {c.lessonCount} lessons · {c.studentCount} students
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
