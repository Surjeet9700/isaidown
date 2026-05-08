import { ServiceStatus, isDown } from '@/lib/status';

export default function StatusCard({ s }: { s: ServiceStatus }) {
  const down = isDown(s);

  return (
    <div className={`flex items-center justify-between p-6 border
      ${down ? 'bg-error-bg border-error-border' : 'bg-surface border-border'}`}>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-text-primary">{s.label}</p>
        <p className="text-xs text-text-muted font-mono">
          {s.status === 'unknown' ? 'Checking...' : `${s.latency_ms}ms latency`}
        </p>
        {s.status === 'down' && s.note && (
          <p className="text-xs text-text-muted font-mono mt-0.5">{s.note}</p>
        )}
      </div>
      <div className={`w-2.5 h-2.5 ${
        s.status === 'up' ? 'bg-success' :
        s.status === 'down' ? 'bg-error animate-pulse' :
        'bg-text-muted'
      }`} />
    </div>
  );
}
