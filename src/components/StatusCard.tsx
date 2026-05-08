'use client';

import { useState } from 'react';
import { ServiceStatus, isDown, faviconUrl, latencyColor, latencyLabel } from '@/lib/status';
import Image from 'next/image';

export default function StatusCard({ s }: { s: ServiceStatus }) {
  const down = isDown(s);
  const icon = faviconUrl(s.name);
  const lc = latencyColor(s.latency_ms);
  const ll = latencyLabel(s.latency_ms);
  const [reportState, setReportState] = useState<'idle' | 'loading' | 'reported' | 'blocked'>('idle');
  const [localCount, setLocalCount] = useState(s.report_count ?? 0);
  const reportCount = s.report_count && s.report_count > localCount ? s.report_count : localCount;

  const handleReport = async () => {
    if (reportState !== 'idle') return;
    setReportState('loading');
    try {
      const workerUrl = (window as unknown as { __WORKER_URL?: string }).__WORKER_URL
        ?? process.env.NEXT_PUBLIC_WORKER_URL
        ?? 'https://ai-status-worker.surjeethkumar4.workers.dev';
      const res = await fetch(`${workerUrl}/report/${s.name}`, { method: 'POST' });
      if (res.status === 429) {
        setReportState('blocked');
        setTimeout(() => setReportState('idle'), 5000);
        return;
      }
      if (res.ok) {
        setReportState('reported');
        setLocalCount(c => c + 1);
      } else {
        setReportState('idle');
      }
    } catch {
      setReportState('idle');
    }
  };

  return (
    <div className={`flex flex-col p-5 border
      ${down ? 'bg-error-bg border-error-border' : 'bg-surface border-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {icon && <Image src={icon} alt="" width={20} height={20} className="shrink-0" unoptimized />}
          <p className="text-[15px] font-semibold text-text-primary">{s.label}</p>
        </div>
        <div className={`w-2.5 h-2.5 shrink-0 ${
          s.status === 'up' ? 'bg-success' :
          s.status === 'down' ? 'bg-error animate-pulse' :
          'bg-text-muted'
        }`} />
      </div>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-mono ${s.status === 'unknown' ? 'text-text-muted' : lc}`}>
          {s.status === 'unknown' ? 'Checking...' : `${s.latency_ms}ms`}
          {ll && <span className="text-text-muted">{ll}</span>}
        </p>
        <a
          href={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live'}/${s.name}`}
          className="text-xs text-text-muted font-mono underline underline-offset-2 hover:text-text-secondary transition-colors"
        >
          Details →
        </a>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <button
          onClick={handleReport}
          disabled={reportState === 'loading'}
          className={`text-xs font-mono px-2.5 py-1 border transition-colors
            ${reportState === 'reported' ? 'border-success/40 text-success cursor-default' :
            reportState === 'blocked' ? 'border-text-muted/30 text-text-muted cursor-default' :
            'border-border text-text-muted hover:border-error/40 hover:text-error cursor-pointer'}`}
        >
          {reportState === 'reported' ? 'Reported ✓' :
           reportState === 'blocked' ? 'Wait before reporting again' :
           reportState === 'loading' ? 'Sending...' :
           '🚨 Report Issue'}
        </button>
        {reportCount > 0 && (
          <span className="text-xs text-text-muted font-mono">
            {reportCount} {reportCount === 1 ? 'person' : 'people'} reported
          </span>
        )}
      </div>

      {s.status === 'down' && s.note && (
        <p className="text-xs text-text-muted font-mono mt-2">{s.note}</p>
      )}
    </div>
  );
}
