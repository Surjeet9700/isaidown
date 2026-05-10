'use client';

import { useState } from 'react';
import { ServiceStatus, isDown, faviconUrl, latencyColor, latencyLabel, ErrorType, HistoryEntry } from '@/lib/status';
import Image from 'next/image';
import { Wifi, WifiOff, AlertTriangle, Globe, Flag, Bell, Mail } from 'lucide-react';
import Link from 'next/link';

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
  const [reportState, setReportState] = useState<'idle' | 'selecting' | 'loading' | 'reported' | 'blocked'>('idle');
  const [emailState, setEmailState] = useState<'idle' | 'open' | 'loading' | 'done'>('idle');
  const [emailInput, setEmailInput] = useState('');
  const reportCount = s.report_count ?? 0;

  const PROBLEM_TYPES = [
    { key: 'website', label: 'Website down' },
    { key: 'login', label: 'Login issues' },
    { key: 'api', label: 'API not working' },
    { key: 'slow', label: 'Very slow' },
    { key: 'other', label: 'Other' },
  ];

  const handleReport = async (type: string) => {
    if (reportState !== 'selecting') return;
    setReportState('loading');
    try {
      const workerUrl = (window as unknown as { __WORKER_URL?: string }).__WORKER_URL
        ?? process.env.NEXT_PUBLIC_WORKER_URL;
      if (!workerUrl) return;
      const res = await fetch(`${workerUrl}/report/${s.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (res.status === 429) {
        setReportState('blocked');
        setTimeout(() => setReportState('idle'), 5000);
        return;
      }
      if (res.ok) {
        setReportState('reported');
      } else {
        setReportState('idle');
      }
    } catch {
      setReportState('idle');
    }
  };

  const handleEmailSubscribe = async () => {
    if (emailState !== 'open' || !emailInput.includes('@')) return;
    setEmailState('loading');
    try {
      const workerUrl = (window as unknown as { __WORKER_URL?: string }).__WORKER_URL
        ?? process.env.NEXT_PUBLIC_WORKER_URL;
      if (!workerUrl) return;
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

  const confPct = s.confidence ? Math.round(s.confidence * 100) : null;
  const confLabel = confPct ? (confPct >= 95 ? 'High' : confPct >= 85 ? 'Good' : confPct >= 70 ? 'Moderate' : 'Low') : null;
  const confColor = confPct ? (confPct >= 85 ? 'text-success' : confPct >= 70 ? 'text-yellow-400' : 'text-error') : 'text-text-muted';

  const reportTypes = s.report_types;
  const typeEntries = reportTypes
    ? Object.entries(reportTypes).sort(([, a], [, b]) => b - a).slice(0, 3)
    : [];

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
              {confPct && (
                <span className={`text-[10px] font-mono ${confColor}`}>{confLabel} confidence</span>
              )}
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
        <Link
          href={`/${s.name}`}
          className="text-xs text-text-muted font-mono underline underline-offset-2 hover:text-text-secondary transition-colors"
        >
          Details →
        </Link>
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

      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border gap-2">
        {reportState === 'idle' && (
          <button
            onClick={() => setReportState('selecting')}
            className="text-[10px] font-mono px-2 py-1 border border-border text-text-muted hover:border-error/40 hover:text-error transition-colors cursor-pointer flex items-center gap-1"
          >
            <Flag className="w-3 h-3" />
            Report Issue
          </button>
        )}
        {reportState === 'selecting' && (
          <div className="flex items-center gap-1 flex-wrap">
            {PROBLEM_TYPES.map(pt => (
              <button
                key={pt.key}
                onClick={() => handleReport(pt.key)}
                className="text-[10px] font-mono px-2 py-1 border border-border text-text-muted hover:border-error/40 hover:text-error transition-colors cursor-pointer"
              >
                {pt.label}
              </button>
            ))}
            <button
              onClick={() => setReportState('idle')}
              className="text-[10px] font-mono px-2 py-1 text-text-muted hover:text-text-secondary cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
        {reportState === 'loading' && (
          <span className="text-[10px] font-mono text-text-muted">Reporting...</span>
        )}
        {reportState === 'reported' && (
          <span className="text-[10px] font-mono text-success flex items-center gap-1">
            <Flag className="w-3 h-3" /> Reported
          </span>
        )}
        {reportState === 'blocked' && (
          <span className="text-[10px] font-mono text-text-muted">Wait before reporting again</span>
        )}
        <div className="flex items-center gap-1.5">
          {reportCount > 0 && (
            <span className="text-[10px] text-text-muted font-mono">{reportCount}</span>
          )}
        </div>
      </div>

      {typeEntries.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {typeEntries.map(([key, count]) => (
            <span key={key} className="text-[9px] font-mono text-text-muted bg-surface px-1.5 py-0.5 border border-border">
              {PROBLEM_TYPES.find(t => t.key === key)?.label ?? key} ({count})
            </span>
          ))}
        </div>
      )}

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
