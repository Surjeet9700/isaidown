import { ServiceStatus, isDown, faviconUrl, latencyColor, latencyLabel } from '@/lib/status';
import Image from 'next/image';

export default function StatusCard({ s }: { s: ServiceStatus }) {
  const down = isDown(s);
  const icon = faviconUrl(s.name);
  const lc = latencyColor(s.latency_ms);
  const ll = latencyLabel(s.latency_ms);

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
          href={`https://isaidown.live/${s.name}`}
          className="text-xs text-text-muted font-mono underline underline-offset-2 hover:text-text-secondary transition-colors"
        >
          Details →
        </a>
      </div>
      {s.status === 'down' && s.note && (
        <p className="text-xs text-text-muted font-mono mt-2">{s.note}</p>
      )}
    </div>
  );
}
