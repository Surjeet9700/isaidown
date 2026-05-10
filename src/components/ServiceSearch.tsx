'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

type Service = { name: string; label: string; status: string };

export default function ServiceSearch({ services }: { services: Service[] }) {
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? services.filter(s => s.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search services..."
          className="flex-1 text-sm font-mono bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </div>
      {filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border z-10 max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <Link
              key={s.name}
              href={`/${s.name}`}
              className="flex items-center justify-between px-3 py-2 hover:bg-background transition-colors"
              onClick={() => setQuery('')}
            >
              <span className="text-sm font-mono text-text-primary">{s.label}</span>
              <span className={`text-[10px] font-mono ${s.status === 'up' ? 'text-success' : s.status === 'down' ? 'text-error' : 'text-text-muted'}`}>
                {s.status.toUpperCase()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
