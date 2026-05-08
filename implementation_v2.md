# IsAIDown.live — Implementation Guide (Corrected)
> $0 budget · Solo build · 5–7 days with Next.js + Cloudflare

---

## 🏗️ Architecture (What Changed From v1)

| Layer | OLD (Broken) | NEW (Fixed) | Why |
|-------|-------------|-------------|-----|
| DB | MongoDB Data API | **Cloudflare KV** | Data API shut down Sep 2025 |
| Page type | `force-static` + `revalidate` (conflict) | **ISR only** (`revalidate = 60`) | force-static kills ISR |
| Ping targets | Hardcoded unverified endpoints | **HEAD + Reddit fallback (hardcoded subs)** | Avoids false positives |
| Subreddit routing | capitalize() function (broken) | **Hardcoded redditSub per target** | No wrong subreddit paths |

### Final Stack
```
Cloudflare Worker (Cron every 2 min)
  → HEAD request each AI tool
  → Reddit JSON fallback if blocked
  → Write result to Cloudflare KV

Next.js on Vercel (ISR, revalidate: 60)
  → GET /api/status → reads Cloudflare Worker GET route → reads KV
  → UI shows live status
  → Dynamic <title> for SEO
```

**Total cost: $0. Forever. Until 100k users/day.**

---

## ⚙️ Phase 1: Cloudflare Setup (KV + Worker)

### 1.1 Create KV Namespace
```bash
npm install -g wrangler
wrangler login
wrangler kv:namespace create "STATUS_KV"
# Copy the id from output — you'll need it in wrangler.toml
```

### 1.2 `wrangler.toml`
```toml
name = "ai-status-worker"
main = "src/index.js"
compatibility_date = "2026-05-08"

[[kv_namespaces]]
binding = "STATUS_KV"
id = "PASTE_YOUR_KV_NAMESPACE_ID_HERE"

[triggers]
crons = ["*/2 * * * *"]
```

### 1.3 `src/index.js` — The Full Worker
```javascript
// ─── Target definitions ────────────────────────────────────────────
// Always hardcode redditSub — do NOT auto-derive from name.
// HEAD url is the homepage. If it 200/301, tool is up.
const TARGETS = [
  {
    name: 'character_ai',
    label: 'Character AI',
    url: 'https://character.ai',
    redditSub: 'CharacterAI',
  },
  {
    name: 'janitor_ai',
    label: 'Janitor AI',
    url: 'https://janitorai.com',
    redditSub: 'JanitorAI',
  },
  {
    name: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chat.openai.com',
    redditSub: 'ChatGPT',
  },
  {
    name: 'claude',
    label: 'Claude',
    url: 'https://claude.ai',
    redditSub: 'ClaudeAI',
  },
  {
    name: 'gemini',
    label: 'Gemini',
    url: 'https://gemini.google.com',
    redditSub: 'Gemini',
  },
  {
    name: 'perplexity',
    label: 'Perplexity',
    url: 'https://perplexity.ai',
    redditSub: 'perplexity_ai',
  },
  {
    name: 'cursor',
    label: 'Cursor',
    url: 'https://cursor.sh',
    redditSub: 'cursor',
  },
  {
    name: 'midjourney',
    label: 'Midjourney',
    url: 'https://midjourney.com',
    redditSub: 'midjourney',
  },
];

// ─── Direct HTTP ping ──────────────────────────────────────────────
async function pingDirect(target) {
  const start = Date.now();
  try {
    const resp = await fetch(target.url, {
      method: 'HEAD',
      redirect: 'follow',               // follow 301s — homepage redirects are fine
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'ai-status-checker/1.0 (monitoring bot)' },
    });
    const latency = Date.now() - start;
    // 200, 301, 302, 403 all mean the server is alive
    // Only 5xx = real outage
    const up = resp.status < 500;
    return {
      status: up ? 'up' : 'down',
      latency_ms: latency,
      http_code: resp.status,
      source: 'direct',
      confidence: up ? 0.95 : 0.75, // low conf if down — confirm via Reddit
    };
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      http_code: 0,
      source: 'direct',
      confidence: 0.6, // timeout could be a Worker IP block, not real outage
      error: err.message,
    };
  }
}

// ─── Reddit panic signal ───────────────────────────────────────────
// Checks if recent posts contain outage keywords.
// DO NOT use this as primary signal — too slow and noisy.
// Use ONLY to confirm when direct ping confidence < 0.8.
const OUTAGE_KEYWORDS = ['down', 'not working', 'error', '503', '500', 'offline', 'broken', 'cant login', "can't log"];

async function checkReddit(sub) {
  try {
    const url = `https://www.reddit.com/r/${sub}/new.json?limit=25`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'ai-status-checker/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null; // Reddit itself down — skip

    const data = await resp.json();
    const posts = data?.data?.children ?? [];
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    // Only look at posts from last 5 minutes
    const recentPosts = posts.filter(
      (p) => p.data.created_utc * 1000 > fiveMinAgo
    );

    const outagePosts = recentPosts.filter((p) =>
      OUTAGE_KEYWORDS.some((k) =>
        p.data.title.toLowerCase().includes(k)
      )
    );

    // Heuristic: >3 outage posts in last 5 min = likely down
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

// ─── Combined check ────────────────────────────────────────────────
async function checkService(target) {
  const direct = await pingDirect(target);

  // If direct ping is confident — trust it
  if (direct.confidence >= 0.8) return direct;

  // Low confidence (timeout/IP block) — cross-check Reddit
  const reddit = await checkReddit(target.redditSub);

  if (!reddit) return direct; // Reddit down — best we have

  // Both sources say down = high confidence down
  // Disagreement = probably just IP block on Worker, service is up
  if (direct.status === 'down' && reddit.status === 'down') {
    return { ...direct, confidence: 0.9, source: 'hybrid_down' };
  }
  if (direct.status === 'down' && reddit.status === 'up') {
    // Worker IP blocked — service likely up
    return { ...direct, status: 'up', confidence: 0.7, source: 'hybrid_up', note: 'direct blocked, reddit clear' };
  }

  return direct;
}

// ─── Worker entry point ────────────────────────────────────────────
export default {
  // Cron trigger — runs every 2 minutes
  async scheduled(event, env, ctx) {
    const results = await Promise.allSettled(
      TARGETS.map(async (target) => {
        const result = await checkService(target);
        const payload = JSON.stringify({
          ...result,
          name: target.name,
          label: target.label,
          timestamp: new Date().toISOString(),
        });
        // KV key: "status:character_ai" — TTL 10 min (safety net if cron stops)
        await env.STATUS_KV.put(`status:${target.name}`, payload, {
          expirationTtl: 600,
        });
      })
    );

    // Log failures (visible in Cloudflare dashboard)
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Failed: ${TARGETS[i].name}`, r.reason);
      }
    });
  },

  // HTTP GET route — Next.js frontend calls this to read status
  // Route: GET https://ai-status-worker.YOUR_SUBDOMAIN.workers.dev/status
  // Route: GET /status/:service
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS — allow your Vercel domain
    const corsHeaders = {
      'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=55', // slightly under revalidate window
    };

    if (url.pathname === '/status/all') {
      const all = await Promise.all(
        TARGETS.map(async (t) => {
          const raw = await env.STATUS_KV.get(`status:${t.name}`);
          return raw ? JSON.parse(raw) : { name: t.name, status: 'unknown' };
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
```

### 1.4 Deploy Worker
```bash
wrangler deploy
# Output: https://ai-status-worker.YOUR_SUBDOMAIN.workers.dev

# Test it manually first:
wrangler dev   # local
# In another terminal:
curl "http://localhost:8787/status/all"
```

---

## 💻 Phase 2: Next.js Frontend (Vercel)

### 2.1 Scaffold
```bash
npx create-next-app@latest isaidown --app --src-dir --tailwind --typescript
cd isaidown
```

### 2.2 `.env.local`
```bash
# Your deployed Worker URL
WORKER_URL=https://ai-status-worker.YOUR_SUBDOMAIN.workers.dev
REVALIDATE_SECRET=pick_any_random_string_32chars
```

### 2.3 Directory Structure
```
src/
  app/
    page.tsx                  # Main page (ISR, revalidate 60)
    layout.tsx                # Dynamic <title> for SEO
    api/
      status/route.ts         # Proxy to Worker (hides Worker URL)
      revalidate/route.ts     # On-demand revalidation webhook
  components/
    StatusGrid.tsx            # All tools grid
    StatusCard.tsx            # Single tool card
    DownBanner.tsx            # Affiliate CTA — shows only when down
  lib/
    status.ts                 # Typed fetch from Worker API
```

### 2.4 `src/lib/status.ts`
```typescript
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

const WORKER_URL = process.env.WORKER_URL!;

export async function getAllStatus(): Promise<ServiceStatus[]> {
  const res = await fetch(`${WORKER_URL}/status/all`, {
    next: { revalidate: 60 },  // ISR — cached 60s, then regenerated on next hit
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getServiceStatus(name: string): Promise<ServiceStatus | null> {
  const res = await fetch(`${WORKER_URL}/status/${name}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export function isDown(s: ServiceStatus): boolean {
  return s.status === 'down' && s.confidence >= 0.7;
}
```

### 2.5 `src/app/page.tsx`
```typescript
// ISR: cache this page for 60 seconds.
// DO NOT add `export const dynamic = 'force-static'` — it kills ISR.
export const revalidate = 60;

import { getAllStatus, isDown } from '@/lib/status';
import StatusGrid from '@/components/StatusGrid';
import DownBanner from '@/components/DownBanner';

export default async function Home() {
  const statuses = await getAllStatus();
  const downServices = statuses.filter(isDown);
  const anyDown = downServices.length > 0;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-2">
          Is AI Down?
        </h1>
        <p className="text-gray-400 text-center mb-10">
          Real-time status for 8 major AI tools. Updated every 60 seconds.
        </p>

        {/* Affiliate CTA — ONLY renders when something is actually down */}
        {anyDown && <DownBanner downServices={downServices} />}

        <StatusGrid statuses={statuses} />

        <p className="text-center text-gray-600 text-xs mt-10">
          Last checked: {new Date(statuses[0]?.timestamp ?? Date.now()).toUTCString()}
        </p>
      </div>
    </main>
  );
}
```

### 2.6 `src/app/layout.tsx`
```typescript
import { getAllStatus, isDown } from '@/lib/status';
import type { Metadata } from 'next';

// Dynamic metadata — title changes based on live outage status
export async function generateMetadata(): Promise<Metadata> {
  const statuses = await getAllStatus();
  const downServices = statuses.filter(isDown);

  const title = downServices.length > 0
    ? `🔴 ${downServices.map(s => s.label).join(', ')} DOWN — AI Status Check`
    : '🟢 All AI Tools Up — Real-Time Status Checker';

  const description = downServices.length > 0
    ? `${downServices.map(s => s.label).join(' and ')} ${downServices.length > 1 ? 'are' : 'is'} currently down. Find working alternatives instantly.`
    : 'All AI tools are online. Real-time uptime monitoring for ChatGPT, Claude, Gemini, Character AI, and more.';

  return {
    title,
    description,
    openGraph: { title, description },
    // Canonical: helps Google consolidate rank signal
    alternates: { canonical: 'https://isaidown.live' },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### 2.7 `src/app/api/revalidate/route.ts`
```typescript
// ✅ FIX: import was missing in v1 — this caused a runtime crash
import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidatePath('/');
  return Response.json({ revalidated: true, ts: Date.now() });
}
```

### 2.8 `src/components/DownBanner.tsx`
```typescript
import { ServiceStatus } from '@/lib/status';

// ─── Affiliate / alternative map ──────────────────────────────────
// Rule: ONLY render when the primary service is confirmed DOWN.
// Showing this when a tool is UP = dark pattern = users distrust your data.
//
// Add ?ref=isaidown to any URL with an affiliate program so Plausible
// can tell you which outage event drove which click.
//
// Confirmed affiliate programs (as of May 2026):
//   Copy.ai       → copy.ai/affiliate          (45% recurring)
//   Writesonic    → writesonic.com/affiliate    (30% recurring)
//   Jasper        → partnerstack.com            (25% recurring)
//   NightCafe     → nightcafe.studio/affiliate  (15% of purchases)
//
// For tools that redirect to each other (ChatGPT ↔ Claude) there's no
// affiliate commission — but the traffic signal still builds your brand.
const ALTERNATIVES: Record<string, { label: string; url: string }> = {
  character_ai: { label: 'Try Janitor AI →',  url: 'https://janitorai.com?ref=isaidown' },
  janitor_ai:   { label: 'Try Character AI →', url: 'https://character.ai?ref=isaidown' },
  chatgpt:      { label: 'Try Claude →',       url: 'https://claude.ai?ref=isaidown' },
  claude:       { label: 'Try ChatGPT →',      url: 'https://chat.openai.com?ref=isaidown' },
  gemini:       { label: 'Try Perplexity →',   url: 'https://perplexity.ai?ref=isaidown' },
  perplexity:   { label: 'Try Gemini →',       url: 'https://gemini.google.com?ref=isaidown' },
  cursor:       { label: 'Try Writesonic →',   url: 'https://writesonic.com?ref=isaidown' },
  midjourney:   { label: 'Try NightCafe →',    url: 'https://nightcafe.studio?ref=isaidown' },
};

export default function DownBanner({ downServices }: { downServices: ServiceStatus[] }) {
  const primary = downServices[0];
  const alt = ALTERNATIVES[primary.name];

  return (
    <div className="mb-8 p-6 bg-red-900/40 border border-red-500/50 rounded-2xl text-center">
      <p className="text-red-300 font-semibold mb-1">
        🔴 {downServices.map(s => s.label).join(', ')} {downServices.length > 1 ? 'are' : 'is'} DOWN
      </p>
      <p className="text-gray-400 text-sm mb-4">
        Our monitors confirmed this. Try a working alternative:
      </p>
      {alt && (
        <a
          href={alt.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-full transition-colors"
        >
          {alt.label} →
        </a>
      )}
    </div>
  );
}
```

### 2.9 `src/components/StatusCard.tsx`
```typescript
import { ServiceStatus, isDown } from '@/lib/status';

export default function StatusCard({ s }: { s: ServiceStatus }) {
  const down = isDown(s);

  return (
    <div className={`rounded-xl border p-4 flex items-center justify-between
      ${down ? 'border-red-500/50 bg-red-900/20' : 'border-gray-700 bg-gray-900'}`}>
      <div>
        <p className="font-medium">{s.label}</p>
        <p className="text-xs text-gray-500">
          {s.status === 'unknown' ? 'Checking...' : `${s.latency_ms}ms`}
        </p>
      </div>
      <div className={`w-3 h-3 rounded-full ${
        s.status === 'up' ? 'bg-green-400' :
        s.status === 'down' ? 'bg-red-500 animate-pulse' :
        'bg-yellow-400'
      }`} />
    </div>
  );
}
```

---

## 🔍 Phase 3: SEO (The Actual Moat)

### Target Keywords (per tool page — future expansion)
```
"is character ai down"           → 90k/mo searches
"character ai not working"       → 60k/mo
"character ai 500 error"         → 12k/mo
"is chatgpt down right now"      → 200k/mo
"janitor ai 502"                 → 8k/mo
"is claude down"                 → 15k/mo
```

### FAQ Schema (add to page.tsx)
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{__html: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": statuses.map(s => ({
      "@type": "Question",
      "name": `Is ${s.label} down right now?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": `As of ${new Date(s.timestamp).toUTCString()}, ${s.label} is ${s.status.toUpperCase()}.`
      }
    }))
  })}}
/>
```

### Sitemap (`src/app/sitemap.ts`)
```typescript
export default function sitemap() {
  return [
    { url: 'https://isaidown.live', changeFrequency: 'always', priority: 1 },
  ];
}
```

---

## ⚡ Phase 4.5: State Change Detection (Critical Update)

The Worker currently writes to KV every 2 minutes unconditionally. That's wrong.
**You only care when status FLIPS** — up→down or down→up. Everything else (auto-tweet, alerts) depends on detecting this flip. Add this before deploying.

### Updated Worker logic in `checkService()`
```javascript
// ─── State change detection ────────────────────────────────────────
// Call this after checkService() returns a result, before writing to KV
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
    // Track when it went down — useful for "down for X minutes" UI
    downSince: newStatus === 'down'
      ? (prevStatus === 'down' ? prev.downSince : new Date().toISOString())
      : null,
  };

  // Always write latest status
  await env.STATUS_KV.put(kvKey, JSON.stringify(payload), {
    expirationTtl: 600,
  });

  // Only return flipped=true when state actually changed
  return { payload, flipped, prevStatus, newStatus };
}
```

### Updated `scheduled()` handler
```javascript
export default {
  async scheduled(event, env, ctx) {
    const results = await Promise.allSettled(
      TARGETS.map(async (target) => {
        const result = await checkService(target);
        const { payload, flipped, prevStatus, newStatus } = await detectAndWrite(env, target, result);

        // Only fire side effects on state change
        if (flipped) {
          console.log(`[FLIP] ${target.label}: ${prevStatus} → ${newStatus}`);

          // Fire auto-tweet (Phase 5)
          ctx.waitUntil(postOutageTweet(env, target, newStatus));

          // Optionally: call Vercel revalidate webhook to bust ISR cache immediately
          ctx.waitUntil(bustVercelCache(env));
        }
      })
    );
  },

  async fetch(request, env) {
    // ... same as before
  }
};

// Bust Vercel ISR cache on state change (optional but makes UI update instantly)
async function bustVercelCache(env) {
  try {
    await fetch(env.VERCEL_REVALIDATE_URL, {
      method: 'POST',
      headers: { 'x-revalidate-secret': env.REVALIDATE_SECRET },
    });
  } catch (e) {
    console.error('Cache bust failed:', e.message);
  }
}
```

### New `wrangler.toml` secrets to add
```bash
wrangler secret put VERCEL_REVALIDATE_URL   # https://yourapp.vercel.app/api/revalidate
wrangler secret put REVALIDATE_SECRET       # same string as in Next.js .env
```

---

## 🐦 Phase 5: Auto-Tweet on Outage (Free Viral Traffic)

Every time a major AI tool goes down, Twitter/X erupts. Your Worker should **post automatically** the moment it detects a flip. This drives traffic before anyone finds you via Google.

### X API Setup (Free Tier)
1. Go to [developer.x.com](https://developer.x.com) → Create a new app
2. Create a **dedicated account**: `@IsAIDown` or `@AIStatusLive`
3. Under your app → Keys and Tokens → generate:
   - API Key + Secret
   - Access Token + Secret (for the `@IsAIDown` account)
4. Free tier allows **500 tweets/month** — more than enough (you only tweet on state changes)

### `src/twitter.js` — Add to Worker
```javascript
// OAuth 1.0a tweet poster — no library needed in CF Workers
// Reference: https://developer.twitter.com/en/docs/authentication/oauth-1-0a

export async function postOutageTweet(env, target, newStatus) {
  if (!env.TWITTER_API_KEY) return; // skip if not configured

  const isDown = newStatus === 'down';
  const message = isDown
    ? `🔴 ${target.label} is DOWN right now.\n\nCheck status + find alternatives: https://isaidown.live\n\n#${target.name.replace('_', '')} #AIDown #isdown`
    : `🟢 ${target.label} is back UP.\n\nAll clear: https://isaidown.live\n\n#${target.name.replace('_', '')}`;

  try {
    const url = 'https://api.twitter.com/2/tweets';
    const authHeader = buildOAuthHeader(env, 'POST', url, {});

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });
  } catch (e) {
    console.error('Tweet failed:', e.message);
    // Non-fatal — don't let tweet failure break the Worker
  }
}

// Minimal OAuth 1.0a header builder (no external deps)
function buildOAuthHeader(env, method, url, params) {
  const oauthParams = {
    oauth_consumer_key: env.TWITTER_API_KEY,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: env.TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  // Note: Full HMAC-SHA1 signing required — use a Worker-compatible
  // implementation or the x-oauth-1.0a npm package (bundle with wrangler)
  // Alternatively, use Twitter OAuth 2.0 Bearer Token for app-only auth
  // and post via a Next.js API route instead (simpler for v1)

  // Simpler path for MVP: proxy tweet POST through Next.js API route
  // Worker → POST env.VERCEL_TWEET_URL → Next.js signs with full Node crypto
  return `OAuth oauth_consumer_key="${env.TWITTER_API_KEY}"`;
}
```

### Simpler MVP: Tweet via Next.js API Route
OAuth 1.0a is complex in CF Workers (no Node.js `crypto`). For MVP, proxy through Next.js:

```typescript
// src/app/api/tweet/route.ts
import { NextRequest } from 'next/server';
import { TwitterApi } from 'twitter-api-v2'; // npm i twitter-api-v2

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-tweet-secret');
  if (secret !== process.env.TWEET_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text } = await req.json();
  await client.v2.tweet(text);
  return Response.json({ ok: true });
}
```

```bash
# wrangler.toml — add
# VERCEL_TWEET_URL = https://yourapp.vercel.app/api/tweet

# wrangler secrets
wrangler secret put TWEET_SECRET
wrangler secret put VERCEL_TWEET_URL

# .env.local — add
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
TWEET_SECRET=...   # same string as wrangler secret

# install
npm i twitter-api-v2
```

**Flow:** Worker detects flip → `ctx.waitUntil(fetch(env.VERCEL_TWEET_URL, { body: JSON.stringify({ text: message }) }))` → Next.js API route signs and posts tweet.

---

## 📣 Phase 6: Manual Seeding Playbook (Day 1 Traffic)

SEO takes 3–6 months. This is how you get your first 1,000 visits **before** Google ranks you.

### Step 1 — Monitor for the next outage
Set up a free UptimeRobot alert on character.ai. When it goes red, you act within 5 minutes.

### Step 2 — Drop the link in the right places (in this order)

**Reddit (highest ROI):**
```
r/CharacterAI — sort by New during outage. Find the panic post.
Comment: "Checking if it's just you: isaidown.live — shows live status"

r/ChatGPT, r/ClaudeAI, r/perplexity_ai — same pattern
r/SideProject — post "I built a real-time status checker for AI tools"
r/InternetIsBeautiful — post after the outage: "Made this during the Character AI outage"
```

**Twitter/X:**
```
Search: "character ai down" sorted by Latest
Reply to the top panic tweets: "Real-time status: isaidown.live"
Post from @IsAIDown account during the outage — it'll pick up followers organically
```

**Discord:**
```
Character AI official Discord — #help or #bugs channel
Midjourney Discord — same
AI-focused servers on Disboard
```

**Hacker News:**
```
"Show HN: I built a real-time status page for 8 major AI tools"
Post on a Monday morning — highest HN traffic
Title matters: be specific, not clever
```

### Step 3 — Track what drives traffic
Add Plausible Analytics (free, open source, privacy-friendly):
```bash
# In Next.js layout.tsx — add to <head>
<script defer data-domain="isaidown.live" src="https://plausible.io/js/script.js" />
```
Check which Reddit thread or Discord server sent the most traffic. Double down on that channel for the next outage.

### Step 4 — Email capture (future)
Add a simple "Notify me when [tool] goes down" email box.
- Use Resend free tier (3,000 emails/month free)
- Store emails in Cloudflare KV: `alert:email:hash`
- Worker → on flip → fetch Resend API → send alert
- This builds a list you own, independent of SEO

---

## 🚀 Deployment Checklist

### Day 1 — Cloudflare Worker
```bash
wrangler deploy
# Test cron manually:
wrangler dev --test-scheduled
# In another terminal:
curl "http://localhost:8787/__scheduled?cron=*%2F2+*+*+*+*"
# Then read KV:
wrangler kv:key get --namespace-id=YOUR_ID "status:character_ai"
```

### Day 2 — Next.js on Vercel
```bash
vercel         # or push to GitHub → auto-deploy
# Set env vars in Vercel dashboard:
# WORKER_URL, REVALIDATE_SECRET
```

### Day 3 — Verify Everything
- [ ] KV keys appearing: `wrangler kv:key list --namespace-id=YOUR_ID`
- [ ] Worker GET route working: `curl $WORKER_URL/status/all`
- [ ] Next.js page rendering live data
- [ ] Title changes when you manually set a KV key to `"down"`
- [ ] `revalidate: 60` confirmed (check Vercel logs — should see ISR hits)
- [ ] FAQ schema valid: [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Sitemap submitted to Google Search Console

### Day 4–5 — Seed Traffic During Next Outage
1. Watch r/CharacterAI, r/ChatGPT for complaint posts
2. Drop your link as a helpful comment: *"checking if it's just you: isaidown.live"*
3. Post in r/SideProject, r/InternetIsBeautiful
4. Tweet with `#CharacterAIdown` or `#ChatGPTdown` during outages

---

## 💰 Cost at Scale

| Service | Free Limit | Your Usage | Headroom |
|---------|-----------|------------|---------|
| Cloudflare Workers | 100k req/day | ~750 cron + ~5k reads/day | 94k/day left |
| Cloudflare KV | 100k reads/day | ~5k/day (Vercel ISR hits) | 95k/day left |
| Vercel Hobby | 100GB bandwidth | ~1GB/month at start | Massive |
| **Total cost** | — | — | **$0** |

Breaks $0 only when you hit **sustained 50k+ visitors/day**.
By then you're earning from ads/affiliates — upgrade is self-funded.
