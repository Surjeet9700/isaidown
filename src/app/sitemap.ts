export default function sitemap() {
  const services = ['character_ai', 'janitor_ai', 'chatgpt', 'claude', 'gemini', 'perplexity', 'cursor', 'midjourney'];

  return [
    { url: 'https://isaidown.live', changeFrequency: 'always', priority: 1 },
    ...services.map((s) => ({
      url: `https://isaidown.live/${s}`,
      changeFrequency: 'always' as const,
      priority: 0.9,
    })),
  ];
}
