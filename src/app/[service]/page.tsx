export const revalidate = 60;

import { SERVICE_DEFINITIONS, getServiceStatus, getServiceDef, isDown } from '@/lib/status';
import StatusGrid from '@/components/StatusGrid';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

export async function generateStaticParams() {
  return SERVICE_DEFINITIONS.map((s) => ({ service: s.name }));
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }): Promise<Metadata> {
  const { service } = await params;
  const def = getServiceDef(service);
  if (!def) return { title: 'Not Found' };

  const status = await getServiceStatus(service);

  const title = status?.status === 'down'
    ? `🔴 ${def.label} DOWN — Is ${def.label} Down Right Now?`
    : `🟢 ${def.label} is UP — Is ${def.label} Down? (Live Status)`;

  const description = status?.status === 'down'
    ? `${def.label} is currently down as of ${new Date(status.timestamp).toUTCString()}. Check live status, find alternatives, and get notified when it's back.`
    : `${def.label} is online and working. Live status monitoring for ${def.label}. Check if ${def.label} is down for everyone or just you.`;

  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live'}/${service}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const def = getServiceDef(service);
  if (!def) notFound();

  const status = await getServiceStatus(service);
  const allStatuses = await (await fetch(`${process.env.WORKER_URL}/status/all`, { next: { revalidate: 60 } }).catch(() => null))?.json() ?? [];
  const down = status ? isDown(status) : false;

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
          "text": `${def.label} may be experiencing an outage, scheduled maintenance, or your local connection may be the issue. Check ${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live'} for real-time status updates.`
        }
      },
      {
        "@type": "Question",
        "name": `What to do if ${def.label} is down?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `If ${def.label} is down, try refreshing the page, clearing your cache, or using an alternative AI service. Check ${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live'} for working alternatives.`
        }
      }
    ]
  };

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="max-w-[1440px] mx-auto">

        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(faqSchema)}} />

        {/* Header */}
        <header className="flex items-center justify-between h-16 px-[64px]">
          <Link href="/" className="text-lg font-bold text-text-primary">IsAIDown.live</Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center px-[64px] pt-[80px] pb-[64px] gap-6">
          <div className={`inline-flex items-center gap-2 px-5 py-2 border ${down ? 'border-error-border bg-error-bg' : 'border-success bg-success-bg'}`}>
            <span className={`w-2.5 h-2.5 ${down ? 'bg-error animate-pulse' : 'bg-success'}`} />
            <span className={`text-sm font-semibold ${down ? 'text-error' : 'text-success'}`}>
              {down ? `${def.label} is DOWN` : `${def.label} is UP`}
            </span>
          </div>
          <h1 className="text-[56px] font-bold leading-[1.1] tracking-[-0.02em] text-text-primary text-center">
            Is {def.label} Down?
          </h1>
          <p className="text-lg text-text-secondary text-center max-w-xl">
            Real-time status for {def.label}. Check if it&apos;s down for everyone or just you.
          </p>
          {status && (
            <div className="inline-flex flex-col items-center gap-1 px-6 py-4 bg-surface border border-border">
              <p className="text-sm font-mono text-text-muted">
                Status: <span className={down ? 'text-error font-semibold' : 'text-success font-semibold'}>{status.status.toUpperCase()}</span>
              </p>
              <p className="text-xs font-mono text-text-tertiary">
                Last checked: {new Date(status.timestamp).toUTCString()} &middot; {status.latency_ms}ms latency
              </p>
            </div>
          )}
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-text-primary text-background text-sm font-semibold"
          >
            View All Services →
          </Link>
        </section>

        {/* All Services Overview */}
        <section className="px-[64px] py-[48px]">
          <h2 className="text-[24px] font-bold text-text-primary tracking-[-0.01em] mb-2">
            {def.label} Status &mdash; Live Monitor
          </h2>
          <p className="text-sm text-text-secondary mb-8 max-w-2xl">
            We check <strong>{def.url}</strong> every 2 minutes using HEAD requests from Cloudflare Workers.
            If the direct check fails, we cross-reference with Reddit community reports to confirm the outage.
          </p>
          <StatusGrid statuses={Array.isArray(allStatuses) ? allStatuses : []} />
        </section>

        {/* Footer */}
        <footer className="flex items-center justify-between px-[64px] py-[48px] border-t border-border">
          <p className="text-xs font-mono text-text-tertiary">
            &copy; 2026 IsAIDown.live &mdash; Community AI status monitor
          </p>
          <p className="text-xs font-mono text-text-muted">
            Monitored via Cloudflare Workers &middot; Updated every 2 minutes
          </p>
        </footer>

      </div>
    </main>
  );
}
