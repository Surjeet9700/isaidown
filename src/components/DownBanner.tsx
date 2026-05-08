import { ServiceStatus } from '@/lib/status';

const ALTERNATIVES: Record<string, { label: string; url: string; desc: string }> = {
  character_ai: { label: 'Janitor AI', url: 'https://janitorai.com?ref=isaidown', desc: 'AI roleplay and character chat platform' },
  janitor_ai:   { label: 'Character AI', url: 'https://character.ai?ref=isaidown', desc: 'AI-powered character conversations' },
  chatgpt:      { label: 'Claude', url: 'https://claude.ai?ref=isaidown', desc: 'Anthropic\'s AI assistant — thoughtful and capable' },
  claude:       { label: 'ChatGPT', url: 'https://chat.openai.com?ref=isaidown', desc: 'OpenAI\'s flagship AI assistant' },
  gemini:       { label: 'Perplexity', url: 'https://perplexity.ai?ref=isaidown', desc: 'AI search engine with real-time citations' },
  perplexity:   { label: 'Gemini', url: 'https://gemini.google.com?ref=isaidown', desc: 'Google\'s most capable AI model, free' },
  cursor:       { label: 'Writesonic', url: 'https://writesonic.com?ref=isaidown', desc: 'AI writing and content generation' },
  midjourney:   { label: 'NightCafe', url: 'https://nightcafe.studio?ref=isaidown', desc: 'AI art generation with multiple models' },
};

export default function DownBanner({ downServices }: { downServices: ServiceStatus[] }) {
  const primaryDown = downServices[0];
  const alt = primaryDown ? ALTERNATIVES[primaryDown.name] : null;

  return (
    <section className="mx-[64px] p-8 bg-error-bg border border-error-border">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2.5 h-2.5 bg-error" />
        <p className="text-base font-semibold text-error">
          {downServices.map(s => s.label).join(', ')} {downServices.length > 1 ? 'are' : 'is'} DOWN
        </p>
      </div>
      <p className="text-sm text-text-secondary mb-5">
        Confirmed by our monitors. Try a working alternative:
      </p>
      {primaryDown && alt && (
        <div className="inline-block p-5 bg-surface border border-border">
          <p className="text-base font-semibold text-text-primary mb-1">{alt.label}</p>
          <p className="text-xs text-text-muted mb-3">{alt.desc}</p>
          <a
            href={alt.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-2.5 bg-success text-black text-sm font-semibold"
          >
            Try {alt.label} →
          </a>
        </div>
      )}
    </section>
  );
}
