export const revalidate = 60;

import { SERVICE_DEFINITIONS, getServiceDef, isDown, getAllStatusWithMeta, ErrorType, HistoryEntry } from '@/lib/status';
import StatusGrid from '@/components/StatusGrid';
import { DotmCircular14 } from '@/components/ui/dotm-circular-14';
import LocalTime from '@/components/LocalTime';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Wifi, WifiOff, Globe, Clock, Activity, BarChart3, Users, ShieldAlert, Server, ExternalLink, AlertTriangle } from 'lucide-react';

export async function generateStaticParams() {
  return SERVICE_DEFINITIONS.map((s) => ({ service: s.name }));
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }): Promise<Metadata> {
  const { service } = await params;
  const def = getServiceDef(service);
  if (!def) return { title: 'Not Found' };

  const { services } = await getAllStatusWithMeta();
  const status = services.find(s => s.name === service) ?? null;

  const title = status?.status === 'down'
    ? `🔴 ${def.label} DOWN — Is ${def.label} Down Right Now?`
    : `🟢 ${def.label} is UP — Is ${def.label} Down? (Live Status)`;

  const description = status?.status === 'down'
    ? `${def.label} is currently down. Check live status, find alternatives, and get notified when it's back.`
    : `${def.label} is online. Live status monitoring. Check if it's down for everyone or just you.`;

  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live'}/${service}` },
  };
}

const ERROR_LABELS: Record<ErrorType, string> = {
  ok: '', http_5xx: 'Server Error', http_4xx: 'Access Blocked',
  dns_failure: 'DNS Failure', timeout: 'Connection Timeout', tls_error: 'TLS Error',
  connection_refused: 'Connection Refused', connection_reset: 'Connection Reset',
  access_denied: 'Access Denied', unknown_error: 'Unknown',
};

const ALTERNATIVES: Record<string, { label: string; url: string }> = {
  character_ai: { label: 'Janitor AI', url: 'https://janitorai.com?ref=isaidown' },
  janitor_ai:   { label: 'Character AI', url: 'https://character.ai?ref=isaidown' },
  chatgpt:      { label: 'Claude', url: 'https://claude.ai?ref=isaidown' },
  claude:       { label: 'ChatGPT', url: 'https://chat.openai.com?ref=isaidown' },
  gemini:       { label: 'Perplexity', url: 'https://perplexity.ai?ref=isaidown' },
  perplexity:   { label: 'Gemini', url: 'https://gemini.google.com?ref=isaidown' },
  midjourney:   { label: 'NightCafe', url: 'https://nightcafe.studio?ref=isaidown' },
};

function ResponseTimeChart({ history }: { history: HistoryEntry[] }) {
  if (!history || history.length < 2) return null;
  const points = history.filter(h => h.s === 1);
  if (points.length < 2) return null;

  const maxMs = Math.max(...points.map(p => p.ms), 1);
  const h = 60;
  const w = 600;
  const pad = { top: 6, right: 4, bottom: 14, left: 38 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const stepX = chartW / (points.length - 1);

  const y = (ms: number) => pad.top + chartH - (ms / maxMs) * chartH;

  const pathD = points.map((p, i) => {
    const x = pad.left + i * stepX;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y(p.ms).toFixed(1)}`;
  }).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="max-w-full">
      <rect width={w} height={h} fill="#18181B" />
      <line x1={pad.left} y1={pad.top} x2={w - pad.right} y2={pad.top} stroke="#27272A" strokeWidth="0.5" />
      <line x1={pad.left} y1={pad.top + chartH} x2={w - pad.right} y2={pad.top + chartH} stroke="#27272A" strokeWidth="0.5" />
      <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" fill="#52525B" fontSize="8" fontFamily="IBM Plex Mono, monospace">{maxMs}ms</text>
      <text x={pad.left - 4} y={pad.top + chartH + 3} textAnchor="end" fill="#52525B" fontSize="8" fontFamily="IBM Plex Mono, monospace">0ms</text>
      <path d={pathD} fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${pathD} L${pad.left + (points.length - 1) * stepX},${pad.top + chartH} L${pad.left},${pad.top + chartH} Z`}
        fill="url(#g)" opacity="0.12" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France', IN: 'India',
  JP: 'Japan', BR: 'Brazil', CA: 'Canada', AU: 'Australia', NL: 'Netherlands',
  SG: 'Singapore', KR: 'South Korea',
};

export default async function ServicePage({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const def = getServiceDef(service);
  if (!def) notFound();

  const { services: allStatuses } = await getAllStatusWithMeta();
  const status = allStatuses.find(s => s.name === service) ?? null;
  const down = status ? isDown(status) : false;

  const otherServices = allStatuses.filter(s => s.name !== service);
  const alt = ALTERNATIVES[service];

  const countries = status?.report_countries ?? {};
  const countryEntries = Object.entries(countries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const totalReports = status?.report_count ?? 0;
  const official = status?.official_status;
  const errorType = status?.error_type && status.error_type !== 'ok' ? status.error_type : null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Is ${def.label} down right now?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `As of ${status ? new Date(status.timestamp).toUTCString() : 'the latest check'}, ${def.label} is ${status?.status?.toUpperCase() || 'UNKNOWN'}.`
        }
      },
      {
        "@type": "Question",
        "name": `Why is ${def.label} not working?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${def.label} may be experiencing an outage, scheduled maintenance, or your local connection may be the issue.`
        }
      },
      {
        "@type": "Question",
        "name": `What to do if ${def.label} is down?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `If ${def.label} is down, try refreshing, clearing your cache, or using an alternative. Check ${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live'} for working alternatives.`
        }
      }
    ]
  };

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="max-w-[1280px] mx-auto">

        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(faqSchema)}} />

        <header className="flex items-center justify-between h-16 px-8">
          <Link href="/" className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-success" />
            IsAIDown.live
          </Link>
        </header>

        {/* Hero */}
        <section className="px-8 pt-10 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${down ? 'bg-error-bg border border-error-border' : 'bg-success-bg border border-success'}`}>
              {down ? <WifiOff className="w-4 h-4 text-error" /> : <Wifi className="w-4 h-4 text-success" />}
              <span className={`text-sm font-semibold ${down ? 'text-error' : 'text-success'}`}>
                {down ? 'DOWN' : 'UP'}
              </span>
            </div>
            {status && (
              <span className="text-xs font-mono text-text-muted flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <LocalTime iso={status.timestamp} />
                <span className="text-text-tertiary">· {status.latency_ms}ms response</span>
              </span>
            )}
          </div>
          <h1 className="text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-text-primary mb-3">
            Is {def.label} Down?
          </h1>
          <p className="text-base text-text-secondary max-w-xl leading-relaxed">
            {down
              ? `${def.label} is experiencing issues. Outage detected at ${status?.downSince ? new Date(status.downSince).toUTCString() : 'unknown time'}.`
              : `${def.label} is online and responding. Last checked moments ago.`}
          </p>
        </section>

        {/* Status Details */}
        <section className="px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Diagnostics */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-5 bg-surface border border-border">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" />
                  Status Details
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'Response Time', value: `${status?.latency_ms ?? '—'}ms`, color: status?.latency_ms && status.latency_ms < 300 ? 'text-success' : status?.latency_ms && status.latency_ms < 800 ? 'text-yellow-400' : 'text-error' },
                    { label: 'HTTP Status', value: status?.http_code ? String(status.http_code) : '—', color: status?.http_code && status.http_code >= 500 ? 'text-error' : 'text-text-primary' },
                    { label: 'Confidence', value: status?.confidence ? `${Math.round(status.confidence * 100)}%` : '—', color: status?.confidence && status.confidence >= 0.9 ? 'text-success' : status?.confidence && status.confidence >= 0.7 ? 'text-yellow-400' : 'text-error' },
                    { label: 'Verified by', value: status?.source ?? '—', color: 'text-text-primary' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center">
                      <span className="text-[11px] font-mono text-text-muted">{row.label}</span>
                      <span className={`text-[11px] font-mono ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                  {errorType && (
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="text-[11px] font-mono text-text-muted">Issue</span>
                      <span className="text-[11px] font-mono text-error flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {ERROR_LABELS[errorType]}
                      </span>
                    </div>
                  )}
                  {status?.note && (
                    <p className="text-[10px] font-mono text-text-muted pt-2 border-t border-border">{status.note}</p>
                  )}
                </div>
              </div>

              {official && (
                <div className={`p-5 border ${official.has_incidents ? 'bg-error-bg border-error-border' : 'bg-surface border-border'}`}>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Official Status
                  </h3>
                  {official.has_incidents ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-mono text-error">{official.active_count} active incident{official.active_count > 1 ? 's' : ''}</p>
                      {official.latest_incident && (
                        <p className="text-[10px] font-mono text-text-muted">{official.latest_incident.name} — {official.latest_incident.status}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] font-mono text-success">No incidents reported</p>
                  )}
                </div>
              )}

              <div className="p-5 bg-surface border border-border">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  User Reports
                </h3>
                {totalReports > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono">
                      <span className="text-text-primary font-semibold">{totalReports}</span>
                      <span className="text-text-muted"> {totalReports === 1 ? 'person' : 'people'} reported</span>
                    </p>
                    {countryEntries.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-border">
                        {countryEntries.map(([code, count]) => (
                          <div key={code} className="flex justify-between text-[10px] font-mono">
                            <span className="text-text-muted flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" />
                              {COUNTRY_NAMES[code] ?? code}
                            </span>
                            <span className="text-text-secondary">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] font-mono text-text-muted">No reports yet</p>
                )}
              </div>
            </div>

            {/* Right: Chart + Actions */}
            <div className="lg:col-span-2 space-y-4">
              {status?.history && status.history.length > 1 && (
                <div className="p-5 bg-surface border border-border">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Response Time — 24h
                  </h3>
                  <ResponseTimeChart history={status.history} />
                </div>
              )}

              {down && alt && (
                <div className="p-5 bg-surface border border-border">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                    Try an Alternative
                  </h3>
                  <a
                    href={alt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-success text-black text-sm font-semibold"
                  >
                    Use {alt.label} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {!down && (
                <div className="p-5 bg-surface border border-border">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                    Troubleshooting
                  </h3>
                  <p className="text-[11px] font-mono text-text-muted leading-relaxed mb-3">
                    If {def.label} isn&apos;t working for you but shows UP above:
                  </p>
                  <ul className="space-y-1.5 text-[11px] font-mono text-text-muted">
                    <li className="flex items-start gap-2">
                      <span className="text-text-tertiary mt-0.5">1.</span>
                      Try clearing your browser cache and cookies
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-text-tertiary mt-0.5">2.</span>
                      Check if a VPN or firewall is blocking {def.url}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-text-tertiary mt-0.5">3.</span>
                      Try accessing from a different network or device
                    </li>
                  </ul>
                </div>
              )}

              {status?.api_status && !status.api_status.ok && (
                <div className="p-4 bg-error-bg/50 border border-error-border/50">
                  <p className="text-[10px] font-mono text-text-muted flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-yellow-400" />
                    API endpoint has issues but the main site is reachable
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Email Alert */}
        <section className="px-8 py-4">
          <div className="p-5 bg-surface border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-success-bg border border-success/30 flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">Get notified if {def.label} goes down</p>
                <p className="text-[10px] font-mono text-text-muted">Free alerts. No spam.</p>
              </div>
            </div>
            <Link
              href={`#subscribe-${service}`}
              className="px-5 py-2.5 bg-text-primary text-background text-xs font-semibold shrink-0"
            >
              Subscribe to Alerts
            </Link>
          </div>
        </section>

        {/* Other Services */}
        <section className="px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">All Services</h2>
            <Link href="/" className="text-[11px] font-mono text-text-muted hover:text-text-secondary transition-colors">
              View all →
            </Link>
          </div>
          {otherServices.length > 0 ? (
            <StatusGrid statuses={otherServices} />
          ) : !process.env.WORKER_URL ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <DotmCircular14 size={36} dotSize={5} speed={1.75} animated />
                <p className="text-xs font-mono text-text-muted">Connecting to monitors...</p>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-text-muted text-center py-12">No status data available yet. Check back shortly.</p>
          )}
        </section>

        <footer className="flex items-center justify-between px-8 py-10 border-t border-border">
          <p className="text-[11px] font-mono text-text-tertiary">
            &copy; 2026 IsAIDown.live &mdash; Community AI status monitor
          </p>
          <p className="text-[11px] font-mono text-text-muted">
            Updated every 2 min &middot; Cloudflare Workers
          </p>
        </footer>

      </div>
    </main>
  );
}
