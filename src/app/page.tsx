export const revalidate = 60;

import { getAllStatusWithMeta, isDown } from '@/lib/status';
import StatusGrid from '@/components/StatusGrid';
import DownBanner from '@/components/DownBanner';
import { DotmCircular14 } from '@/components/ui/dotm-circular-14';
import LocalTime from '@/components/LocalTime';

export default async function Home() {
  const { services: statuses, checkedAt } = await getAllStatusWithMeta();
  const downServices = statuses.filter(isDown);
  const anyDown = downServices.length > 0;
  const allUp = !anyDown && statuses.length > 0;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": statuses.map(s => ({
      "@type": "Question",
      "name": `Is ${s.label} down right now?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": `As of ${new Date(s.timestamp).toUTCString()}, ${s.label} is ${s.status.toUpperCase()}. ${s.status === 'down' ? 'We detected an outage via direct monitoring and Reddit cross-check.' : 'The service is responding normally with a latency of ${s.latency_ms}ms.'}`
      }
    }))
  };

  const faqItems = [
    {
      q: 'How do we check if an AI service is down?',
      a: 'We send HEAD requests to each service every 2 minutes from Cloudflare Workers. If we get a timeout or 5xx error, we cross-check with recent Reddit outage reports from each tool\'s community before confirming an outage.',
    },
    {
      q: 'Is ChatGPT down right now?',
      a: `Check the status card above. As of the latest check, ChatGPT is ${statuses.find(s => s.name === 'chatgpt')?.status?.toUpperCase() || 'UNKNOWN'}. We monitor chat.openai.com every 2 minutes.`,
    },
    {
      q: 'Is Character AI not working?',
      a: `View the Character AI card above for real-time status. We ping character.ai directly and cross-reference r/CharacterAI for user reports.`,
    },
    {
      q: 'Is isaidown.live free to use?',
      a: 'Yes, completely free. No signup required. Monitored via Cloudflare Workers, updated every 2 minutes.',
    },
  ];

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="max-w-[1440px] mx-auto">

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: JSON.stringify(faqSchema)}}
        />

        {/* Header */}
        <header className="flex items-center justify-between h-16 px-[64px]">
          <span className="text-lg font-bold text-text-primary">IsAIDown.live</span>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center px-[64px] pt-[64px] pb-[40px] gap-5">
          {allUp ? (
            <div className="inline-flex items-center gap-2 px-5 py-2 border border-success bg-success-bg">
              <span className="w-2 h-2 bg-success" />
              <span className="text-sm font-semibold text-success">All Systems Operational</span>
            </div>
          ) : anyDown ? (
            <div className="inline-flex items-center gap-2 px-5 py-2 border border-error/50 bg-error-bg">
              <span className="w-2.5 h-2.5 bg-error animate-pulse" />
              <span className="text-sm font-semibold text-error">{downServices.length} Service{downServices.length > 1 ? 's' : ''} Down</span>
            </div>
          ) : null}
          <h1 className="text-[56px] font-bold leading-[1.1] tracking-[-0.02em] text-text-primary text-center">
            Is AI Down?
          </h1>
          <p className="text-lg text-text-secondary text-center max-w-xl">
            Real-time status for {statuses.length > 0 ? statuses.length : '13'} major AI tools. Updated every 60 seconds.
          </p>
          <p className="text-xs text-text-muted font-mono">
            {checkedAt
              ? <>Last checked <LocalTime iso={checkedAt} /></>
              : 'Awaiting data...'}
          </p>
        </section>

        {/* Down Banner */}
        {anyDown && <DownBanner downServices={downServices} />}

        {/* Status Grid */}
        <section className="px-[64px] pb-[48px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h2">Live Status</h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface">
              <span className="w-1.5 h-1.5 bg-success rounded-none" />
              <span className="text-xs font-semibold text-success">Live</span>
            </div>
          </div>
          {statuses.length > 0 ? (
            <StatusGrid statuses={statuses} />
          ) : !process.env.WORKER_URL ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <DotmCircular14 size={40} dotSize={5} speed={1.75} animated />
                <p className="text-xs font-mono text-text-muted">Connecting to monitors...</p>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-text-muted text-center py-20">No status data available yet. Check back shortly.</p>
          )}
        </section>

        {/* FAQ */}
        <section className="px-[64px] py-[48px]">
          <h2 className="text-[24px] font-bold text-text-primary tracking-[-0.01em] mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqItems.map((faq, i) => (
              <div key={i} className="p-6 bg-surface border border-border">
                <h3 className="text-[15px] font-semibold text-text-primary mb-2">{faq.q}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
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
