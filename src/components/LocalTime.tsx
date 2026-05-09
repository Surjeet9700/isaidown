'use client';

import { useEffect, useState } from 'react';

function fmtLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

function fmtUser(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const [formatted, setFormatted] = useState(() => fmtLocal(iso));

  useEffect(() => {
    const user = fmtUser(iso);
    if (user !== formatted) setFormatted(user);
  }, [iso]);

  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
