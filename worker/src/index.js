const TARGETS = [
  { name: 'character_ai', label: 'Character AI', url: 'https://character.ai', redditSub: 'CharacterAI' },
  { name: 'janitor_ai', label: 'Janitor AI', url: 'https://janitorai.com', redditSub: 'JanitorAI' },
  { name: 'chatgpt', label: 'ChatGPT', url: 'https://chat.openai.com', redditSub: 'ChatGPT' },
  { name: 'claude', label: 'Claude', url: 'https://claude.ai', redditSub: 'ClaudeAI' },
  { name: 'gemini', label: 'Gemini', url: 'https://gemini.google.com', redditSub: 'Gemini' },
  { name: 'perplexity', label: 'Perplexity', url: 'https://perplexity.ai', redditSub: 'perplexity_ai' },
  { name: 'cursor', label: 'Cursor', url: 'https://cursor.sh', redditSub: 'cursor' },
  { name: 'midjourney', label: 'Midjourney', url: 'https://midjourney.com', redditSub: 'midjourney' },
];

async function pingDirect(target) {
  const start = Date.now();
  try {
    const resp = await fetch(target.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'ai-status-checker/1.0 (monitoring bot)' },
    });
    const latency = Date.now() - start;
    const up = resp.status < 500;
    return {
      status: up ? 'up' : 'down',
      latency_ms: latency,
      http_code: resp.status,
      source: 'direct',
      confidence: up ? 0.95 : 0.75,
    };
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      http_code: 0,
      source: 'direct',
      confidence: 0.6,
      error: err.message,
    };
  }
}

const OUTAGE_KEYWORDS = ['down', 'not working', 'error', '503', '500', 'offline', 'broken', 'cant login', "can't log"];

async function checkReddit(sub) {
  try {
    const url = `https://www.reddit.com/r/${sub}/new.json?limit=25`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'ai-status-checker/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const posts = data?.data?.children ?? [];
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    const recentPosts = posts.filter(
      (p) => p.data.created_utc * 1000 > fiveMinAgo
    );

    const outagePosts = recentPosts.filter((p) =>
      OUTAGE_KEYWORDS.some((k) =>
        p.data.title.toLowerCase().includes(k)
      )
    );

    const likelyDown = outagePosts.length >= 3;

    return {
      status: likelyDown ? 'down' : 'up',
      source: 'reddit',
      confidence: likelyDown ? 0.7 : 0.5,
      outage_post_count: outagePosts.length,
    };
  } catch {
    return null;
  }
}

async function checkService(target) {
  const direct = await pingDirect(target);

  if (direct.confidence >= 0.8) return direct;

  const reddit = await checkReddit(target.redditSub);

  if (!reddit) return direct;

  if (direct.status === 'down' && reddit.status === 'down') {
    return { ...direct, confidence: 0.9, source: 'hybrid_down' };
  }
  if (direct.status === 'down' && reddit.status === 'up') {
    return { ...direct, status: 'up', confidence: 0.7, source: 'hybrid_up', note: 'direct blocked, reddit clear' };
  }

  return direct;
}

async function detectAndWrite(env, target, newResult) {
  const kvKey = `status:${target.name}`;
  const prevRaw = await env.STATUS_KV.get(kvKey);
  const prev = prevRaw ? JSON.parse(prevRaw) : null;

  const prevStatus = prev?.status ?? 'unknown';
  const newStatus = newResult.status;
  const flipped = prevStatus !== newStatus && prevStatus !== 'unknown';

  const payload = {
    ...newResult,
    name: target.name,
    label: target.label,
    timestamp: new Date().toISOString(),
    downSince: newStatus === 'down'
      ? (prevStatus === 'down' ? prev.downSince : new Date().toISOString())
      : null,
  };

  await env.STATUS_KV.put(kvKey, JSON.stringify(payload), {
    expirationTtl: 600,
  });

  return { payload, flipped, prevStatus, newStatus };
}

async function postOutageTweet(env, target, newStatus) {
  if (!env.TWITTER_API_KEY || !env.VERCEL_TWEET_URL) return;

  const isDown = newStatus === 'down';
  const message = isDown
    ? `🔴 ${target.label} is DOWN right now.\n\nCheck status + find alternatives: https://isaidown.live\n\n#${target.name.replace('_', '')} #AIDown #isdown`
    : `🟢 ${target.label} is back UP.\n\nAll clear: https://isaidown.live\n\n#${target.name.replace('_', '')}`;

  try {
    await fetch(env.VERCEL_TWEET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tweet-secret': env.TWEET_SECRET,
      },
      body: JSON.stringify({ text: message }),
    });
  } catch (e) {
    console.error('Tweet proxy call failed:', e.message);
  }
}

async function bustVercelCache(env) {
  if (!env.VERCEL_REVALIDATE_URL || !env.REVALIDATE_SECRET) return;
  try {
    await fetch(env.VERCEL_REVALIDATE_URL, {
      method: 'POST',
      headers: { 'x-revalidate-secret': env.REVALIDATE_SECRET },
    });
  } catch (e) {
    console.error('Cache bust failed:', e.message);
  }
}

const worker = {
  async scheduled(controller, env, ctx) {
    const results = await Promise.allSettled(
      TARGETS.map(async (target) => {
        const result = await checkService(target);
        const { flipped, prevStatus, newStatus } = await detectAndWrite(env, target, result);

        if (flipped) {
          console.log(`[FLIP] ${target.label}: ${prevStatus} → ${newStatus}`);
          ctx.waitUntil(postOutageTweet(env, target, newStatus));
          ctx.waitUntil(bustVercelCache(env));
        }
      })
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Failed: ${TARGETS[i].name}`, r.reason);
      }
    });
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': env.FRONTEND_ORIGIN ?? '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=55',
    };

    if (url.pathname === '/status/all') {
      const all = await Promise.all(
        TARGETS.map(async (t) => {
          const raw = await env.STATUS_KV.get(`status:${t.name}`);
          return raw ? JSON.parse(raw) : { name: t.name, label: t.label, status: 'unknown' };
        })
      );
      return new Response(JSON.stringify(all), { headers: corsHeaders });
    }

    const match = url.pathname.match(/^\/status\/(.+)$/);
    if (match) {
      const raw = await env.STATUS_KV.get(`status:${match[1]}`);
      if (!raw) return new Response('{"status":"unknown"}', { status: 404, headers: corsHeaders });
      return new Response(raw, { headers: corsHeaders });
    }

    return new Response('Not found', { status: 404 });
  },
};

export default worker;
