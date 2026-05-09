'use client';

import { useState } from 'react';
import { ServiceStatus, isDown, faviconUrl, latencyColor, latencyLabel, ErrorType, HistoryEntry, getServiceDef } from '@/lib/status';
import Image from 'next/image';
import { Wifi, WifiOff, AlertTriangle, Globe, Flag, Bell, Mail, ExternalLink } from 'lucide-react';

const ERROR_LABELS: Record<ErrorType, string> = {
  ok: '',
  http_5xx: 'Server Error',
  http_4xx: 'Blocked',
  dns_failure: 'DNS Failure',
  timeout: 'Timed Out',
  tls_error: 'TLS Error',
  connection_refused: 'Refused',
  connection_reset: 'Reset',
  access_denied: 'Forbidden',
  unknown_error: 'Unknown',
};

const COUNTRY_NAMES: Record<string, string> = {
  US: 'US', GB: 'UK', DE: 'DE', FR: 'FR', IN: 'IN', JP: 'JP', BR: 'BR', CA: 'CA',
  AU: 'AU', NL: 'NL', SG: 'SG', KR: 'KR',
};

function Sparkline({ history }: { history: HistoryEntry[] }) {
  if (!history || history.length < 2) return null;
  const points = history.filter(h => h.s === 1);
  if (points.length < 2) return null;
  const maxMs = Math.max(...points.map(p => p.ms), 1);
  const h = 18;
  const w = 100;
  const pad = 2;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const stepX = usableW / (points.length - 1);

  const colors = points.map(p => {
    if (p.ms < 300) return '#22C55E';
    if (p.ms < 800) return '#EAB308';
    return '#EF4444';
  });

  const pathD = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + usableH - (p.ms / maxMs) * usableH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="relative w-[100px] h-[18px] shrink-0 opacity-60">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={pathD} fill="none" stroke="#22C55E" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
        {points.map((p, i) => {
          const x = pad + i * stepX;
          const y = pad + usableH - (p.ms / maxMs) * usableH;
          return (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.2" fill={colors[i]} opacity="0.6" />
          );
        })}
      </svg>
    </div>
  );
}

export default function StatusCard({ s }: { s: ServiceStatus }) {
  const down = isDown(s);
  const icon = faviconUrl(s.name);
  const lc = latencyColor(s.latency_ms);
  const ll = latencyLabel(s.latency_ms);
  const [reportState, setReportState] = useState<'idle' | 'loading' | 'reported' | 'blocked'>('idle');
  const [localCount, setLocalCount] = useState(s.report_count ?? 0);
  const reportCount = s.report_count && s.report_count > localCount ? s.report_count : localCount;
  const [isItMeState, setIsItMeState] = useState<'idle' | 'loading' | 'same' | 'different'>('idle');
  const [emailState, setEmailState] = useState<'idle' | 'open' | 'loading' | 'done'>('idle');
  const [emailInput, setEmailInput] = useState('');

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

  const handleIsItMe = async () => {
    if (isItMeState !== 'idle') return;
    setIsItMeState('loading');
    const def = getServiceDef(s.name);
    if (!def) { setIsItMeState('idle'); return; }
    try {
      const start = Date.now();
      await fetch(def.url, { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
      const clientMs = Date.now() - start;
      const serverSlow = s.latency_ms > 3000;
      const clientSlow = clientMs > 3000;
      setIsItMeState(serverSlow !== clientSlow ? 'different' : 'same');
    } catch {
      setIsItMeState('different');
    }
  };

  const handleEmailSubscribe = async () => {
    if (emailState !== 'open' || !emailInput.includes('@')) return;
    setEmailState('loading');
    try {
      const workerUrl = (window as unknown as { __WORKER_URL?: string }).__WORKER_URL
        ?? process.env.NEXT_PUBLIC_WORKER_URL
        ?? 'https://ai-status-worker.surjeethkumar4.workers.dev';
      const res = await fetch(`${workerUrl}/subscribe/${s.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      if (res.ok) setEmailState('done');
      else setEmailState('idle');
    } catch {
      setEmailState('idle');
    }
  };

  const errorLabel = s.error_type && s.error_type !== 'ok' ? ERROR_LABELS[s.error_type] : null;
  const apiStatus = s.api_status;
  const showApiStatus = apiStatus && s.status !== 'unknown';
  const apiDown = showApiStatus && !apiStatus.ok;
  const official = s.official_status;
  const countries = s.report_countries;
  const topCountries = countries
    ? Object.entries(countries)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([c, n]) => ({ code: c, name: COUNTRY_NAMES[c] ?? c, count: n }))
    : [];
  const hasHistory = s.history && s.history.length > 0;

  return (
    <div className={`flex flex-col p-5 border
      ${down ? 'bg-error-bg border-error-border' : 'bg-surface border-border'}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {icon && <Image src={icon} alt="" width={20} height={20} className="shrink-0" unoptimized />}
          <p className="text-[15px] font-semibold text-text-primary">{s.label}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasHistory && <Sparkline history={s.history!} />}
          {s.status === 'up' ? (
            <Wifi className="w-4 h-4 text-success" />
          ) : s.status === 'down' ? (
            <WifiOff className="w-4 h-4 text-error animate-pulse" />
          ) : (
            <div className="w-2.5 h-2.5 bg-text-muted" />
          )}
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {s.status === 'unknown' ? (
            <span className="text-xs font-mono text-text-muted">Checking...</span>
          ) : (
            <>
              <span className={`text-xs font-mono ${lc}`}>{s.latency_ms}ms</span>
              {ll && <span className="text-xs font-mono text-text-muted">{ll}</span>}
              {errorLabel && (
                <span className="text-[10px] font-mono text-error bg-error-bg px-1.5 py-0.5 border border-error-border">
                  {errorLabel}
                </span>
              )}
              {s.http_code > 0 && s.error_type === 'http_5xx' && (
                <span className="text-[10px] font-mono text-error">{s.http_code}</span>
              )}
            </>
          )}
        </div>
        <a
          href={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live'}/${s.name}`}
          className="text-xs text-text-muted font-mono underline underline-offset-2 hover:text-text-secondary transition-colors"
        >
          Details →
        </a>
      </div>

      {/* Warnings & diagnostics */}
      <div className="space-y-1 mt-1.5">
        {s.error_page_detected && (
          <p className="text-[10px] font-mono text-error flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Error page detected{s.error_page_sig ? ` — ${s.error_page_sig}` : ''}
          </p>
        )}

        {showApiStatus && apiDown && (
          <p className="text-[10px] font-mono text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            API issues
          </p>
        )}

        {official && (
          <p className={`text-[10px] font-mono ${official.has_incidents ? 'text-error' : 'text-text-muted'}`}>
            {official.has_incidents
              ? `${official.latest_incident?.name ?? 'Incident reported'}`
              : 'No official incidents'}
          </p>
        )}

        {topCountries.length > 0 && (
          <p className="text-[10px] font-mono text-text-muted flex items-center gap-1">
            <Globe className="w-2.5 h-2.5" />
            {topCountries.map(c => `${c.name} (${c.count})`).join(', ')}
          </p>
        )}

        {isItMeState !== 'idle' && (
          <p className={`text-[10px] font-mono ${isItMeState === 'different' ? 'text-yellow-400' : 'text-text-muted'}`}>
            {isItMeState === 'loading' ? 'Testing from your browser...' :
             isItMeState === 'same' ? '✓ Same result from your browser' :
             '⚠ Different from your browser — may be your network'}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReport}
            disabled={reportState === 'loading'}
            className={`text-[10px] font-mono px-2 py-1 border transition-colors flex items-center gap-1
              ${reportState === 'reported' ? 'border-success/40 text-success cursor-default' :
              reportState === 'blocked' ? 'border-text-muted/30 text-text-muted cursor-default' :
              'border-border text-text-muted hover:border-error/40 hover:text-error cursor-pointer'}`}
          >
            <Flag className="w-3 h-3" />
            {reportState === 'reported' ? 'Reported' :
             reportState === 'blocked' ? 'Wait' :
             reportState === 'loading' ? '...' :
             'Report'}
          </button>
          <button
            onClick={handleIsItMe}
            disabled={isItMeState === 'loading'}
            className="text-[10px] font-mono px-2 py-1 border border-border text-text-muted hover:border-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer flex items-center gap-1"
          >
            <Globe className="w-3 h-3" />
            {isItMeState === 'loading' ? 'Checking...' : 'Is it just me?'}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {reportCount > 0 && (
            <span className="text-[10px] text-text-muted font-mono">
              {reportCount}
            </span>
          )}
        </div>
      </div>

      {/* Email subscribe */}
      {emailState === 'idle' ? (
        <button
          onClick={() => setEmailState('open')}
          className="text-[10px] font-mono text-text-muted hover:text-text-secondary transition-colors mt-2 cursor-pointer text-left w-fit flex items-center gap-1"
        >
          <Bell className="w-3 h-3" />
          Get alerted when {s.label} goes down
        </button>
      ) : emailState === 'done' ? (
        <p className="text-[10px] font-mono text-success mt-2 flex items-center gap-1">
          <Mail className="w-3 h-3" /> Subscribed!
        </p>
      ) : (
        <div className="flex items-center gap-1.5 mt-2">
          <input
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 text-[10px] font-mono bg-background border border-border px-2 py-1 text-text-primary outline-none"
            onKeyDown={e => e.key === 'Enter' && handleEmailSubscribe()}
          />
          <button
            onClick={handleEmailSubscribe}
            className="text-[10px] font-mono px-2 py-1 border border-border text-text-muted hover:text-success transition-colors cursor-pointer"
          >
            {emailState === 'loading' ? '...' : 'Subscribe'}
          </button>
        </div>
      )}

      {s.status === 'down' && s.note && (
        <p className="text-xs text-text-muted font-mono mt-2">{s.note}</p>
      )}
    </div>
  );
}
