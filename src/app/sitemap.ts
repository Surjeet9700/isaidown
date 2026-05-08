export default function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown.live';
  const services = ['chatgpt', 'claude', 'gemini', 'character_ai', 'perplexity', 'janitor_ai', 'midjourney', 'cursor', 'grok', 'deepseek', 'canva', 'copilot', 'meta_ai'];

  return [
    { url: siteUrl, changeFrequency: 'always' as const, priority: 1 },
    ...services.map((s) => ({
      url: `${siteUrl}/${s}`,
      changeFrequency: 'always' as const,
      priority: 0.9,
    })),
  ];
}
