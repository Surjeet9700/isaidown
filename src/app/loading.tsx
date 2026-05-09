import { DotmCircular14 } from '@/components/ui/dotm-circular-14';

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <DotmCircular14 size={48} dotSize={6} speed={1.75} animated />
        <p className="text-xs font-mono text-text-muted">Loading status...</p>
      </div>
    </div>
  );
}
