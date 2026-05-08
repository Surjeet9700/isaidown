import { ServiceStatus } from '@/lib/status';
import StatusCard from './StatusCard';

export default function StatusGrid({ statuses }: { statuses: ServiceStatus[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statuses.map((s) => (
        <StatusCard key={s.name} s={s} />
      ))}
    </div>
  );
}
