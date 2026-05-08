export type ServiceStatus = {
  name: string;
  label: string;
  status: 'up' | 'down' | 'unknown';
  latency_ms: number;
  http_code: number;
  confidence: number;
  source: string;
  timestamp: string;
  note?: string;
};

export const SERVICE_DEFINITIONS = [
  { name: 'character_ai', label: 'Character AI', domain: 'character.ai', keyword: 'is character ai down', url: 'https://character.ai' },
  { name: 'janitor_ai', label: 'Janitor AI', domain: 'janitorai.com', keyword: 'is janitor ai down', url: 'https://janitorai.com' },
  { name: 'chatgpt', label: 'ChatGPT', domain: 'chat.openai.com', keyword: 'is chatgpt down right now', url: 'https://chat.openai.com' },
  { name: 'claude', label: 'Claude', domain: 'claude.ai', keyword: 'is claude down', url: 'https://claude.ai' },
  { name: 'gemini', label: 'Gemini', domain: 'gemini.google.com', keyword: 'is gemini down', url: 'https://gemini.google.com' },
  { name: 'perplexity', label: 'Perplexity', domain: 'perplexity.ai', keyword: 'is perplexity down', url: 'https://perplexity.ai' },
  { name: 'cursor', label: 'Cursor', domain: 'cursor.sh', keyword: 'is cursor down', url: 'https://cursor.sh' },
  { name: 'midjourney', label: 'Midjourney', domain: 'midjourney.com', keyword: 'is midjourney down', url: 'https://midjourney.com' },
];

const WORKER_URL = process.env.WORKER_URL;

export async function getAllStatus(): Promise<ServiceStatus[]> {
  if (!WORKER_URL) return [];
  try {
    const res = await fetch(`${WORKER_URL}/status/all`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getServiceStatus(name: string): Promise<ServiceStatus | null> {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/status/${name}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function isDown(s: ServiceStatus): boolean {
  return s.status === 'down' && s.confidence >= 0.7;
}

export function getServiceDef(name: string) {
  return SERVICE_DEFINITIONS.find(d => d.name === name);
}

export function faviconUrl(name: string): string {
  const def = getServiceDef(name);
  if (!def) return '';
  return `https://www.google.com/s2/favicons?domain=${def.domain}&sz=32&t=s`;
}

export function latencyColor(ms: number): string {
  if (ms < 300) return 'text-success';
  if (ms < 800) return 'text-yellow-400';
  return 'text-error';
}

export function latencyLabel(ms: number): string {
  if (ms < 300) return '';
  if (ms < 800) return ' (Slow)';
  return ' (Very Slow)';
}
