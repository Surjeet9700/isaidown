const TARGETS = [
  { name: 'chatgpt', label: 'ChatGPT', url: 'https://chat.openai.com', redditSub: 'ChatGPT', apiUrl: 'https://api.openai.com/v1/models', officialStatusUrl: 'https://status.openai.com/api/v2/summary.json' },
  { name: 'claude', label: 'Claude', url: 'https://claude.ai', redditSub: 'ClaudeAI', apiUrl: 'https://api.anthropic.com/v1/messages', officialStatusUrl: 'https://status.anthropic.com/api/v2/summary.json' },
  { name: 'gemini', label: 'Gemini', url: 'https://gemini.google.com', redditSub: 'Gemini', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models', officialStatusUrl: null },
  { name: 'character_ai', label: 'Character AI', url: 'https://character.ai', redditSub: 'CharacterAI', apiUrl: 'https://plus.character.ai/chat', officialStatusUrl: 'https://status.character.ai/api/v2/summary.json' },
  { name: 'perplexity', label: 'Perplexity', url: 'https://perplexity.ai', redditSub: 'perplexity_ai', apiUrl: 'https://api.perplexity.ai', officialStatusUrl: null },
  { name: 'janitor_ai', label: 'Janitor AI', url: 'https://janitorai.com', redditSub: 'JanitorAI', apiUrl: 'https://janitorai.com/login', officialStatusUrl: null },
  { name: 'midjourney', label: 'Midjourney', url: 'https://midjourney.com', redditSub: 'midjourney', apiUrl: null, officialStatusUrl: 'https://status.midjourney.com/api/v2/summary.json' },
  { name: 'cursor', label: 'Cursor', url: 'https://cursor.sh', redditSub: 'cursor', apiUrl: 'https://api.cursor.sh', officialStatusUrl: 'https://status.cursor.com/api/v2/summary.json' },
  { name: 'grok', label: 'Grok', url: 'https://grok.com', redditSub: 'grok', apiUrl: 'https://api.x.ai/v1/models', officialStatusUrl: null },
  { name: 'deepseek', label: 'DeepSeek', url: 'https://chat.deepseek.com', redditSub: 'DeepSeek', apiUrl: 'https://api.deepseek.com/v1/models', officialStatusUrl: 'https://status.deepseek.com/api/v2/summary.json' },
  { name: 'canva', label: 'Canva AI', url: 'https://www.canva.com', redditSub: 'canva', apiUrl: 'https://api.canva.com', officialStatusUrl: 'https://www.canvastatus.com/api/v2/summary.json' },
  { name: 'copilot', label: 'Copilot', url: 'https://copilot.microsoft.com', redditSub: 'Windows11', apiUrl: 'https://api.github.com', officialStatusUrl: 'https://status.github.com/api/v2/summary.json' },
  { name: 'meta_ai', label: 'Meta AI', url: 'https://www.meta.ai', redditSub: 'facebook', apiUrl: 'https://graph.facebook.com', officialStatusUrl: 'https://metastatus.com/api/v2/summary.json' },
];

function classifyErr(err, httpCode) {
  if (httpCode >= 500) return 'http_5xx';
  if (httpCode >= 400 && httpCode < 500) return 'http_4xx';
  if (!err) return 'ok';
  const msg = (err.message ?? '').toLowerCase();
  if (msg.includes('dns') || msg.includes('enotfound') || msg.includes('name not resolved')) return 'dns_failure';
  if (msg.includes('timeout') || msg.includes('abort')) return 'timeout';
  if (msg.includes('tls') || msg.includes('ssl') || msg.includes('certificate')) return 'tls_error';
  if (msg.includes('refused') || msg.includes('econnrefused')) return 'connection_refused';
  if (msg.includes('reset') || msg.includes('econnreset')) return 'connection_reset';
  if (msg.includes('blocked') || msg.includes('forbidden') || msg.includes('403')) return 'access_denied';
  return 'unknown_error';
}

const ERROR_PAGE_PATTERNS = [
  /502 Bad Gateway/i, /503 Service/i, /504 Gateway/i,
  /nginx error/i, /cloudflare error/i, /origin is unreachable/i,
  /Error 5\d{2}/i, /Service Unavailable/i, /Backend fetch failed/i,
];

async function sniffErrorPage(url) {
  try {
    const resp = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'ai-status-checker/1.0 (monitoring bot)' },
    });
    const reader = resp.body.getReader();
    const { value } = await reader.read();
    reader.cancel();
    if (!value) return null;
    const text = new TextDecoder().decode(value.slice(0, 2048));
    const matched = ERROR_PAGE_PATTERNS.find(p => p.test(text));
    return matched ? { detected: true, signature: String(matched).slice(1, -1) } : { detected: false };
  } catch {
    return null;
  }
}

async function pingUrl(url, timeoutMs) {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'ai-status-checker/1.0 (monitoring bot)' },
    });
    return {
      ok: resp.status < 500,
      latency_ms: Date.now() - start,
      http_code: resp.status,
      error_type: classifyErr(null, resp.status),
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      http_code: 0,
      error_type: classifyErr(err, 0),
      error: err.message,
    };
  }
}

async function pingDirect(target) {
  const main = await pingUrl(target.url, 8000);

  let apiResult = null;
  if (target.apiUrl) {
    apiResult = await pingUrl(target.apiUrl, 6000);
  }

  let errorPage = null;
  if (!main.ok || main.latency_ms > 3000) {
    errorPage = await sniffErrorPage(target.url);
  }

  const primaryUp = main.ok && !(errorPage?.detected);
  const apiOk = apiResult ? apiResult.ok : null;
  const overallOk = primaryUp;
  const apiDegraded = primaryUp && apiOk === false;

  return {
    status: overallOk ? 'up' : 'down',
    latency_ms: main.latency_ms,
    http_code: main.http_code,
    source: 'direct',
    confidence: overallOk ? (apiDegraded ? 0.85 : 0.95) : (main.ok ? 0.55 : 0.75),
    error_type: main.error_type,
    error: main.error ?? undefined,
    api_status: apiResult ? {
      ok: apiResult.ok,
      latency_ms: apiResult.latency_ms,
      http_code: apiResult.http_code,
      error_type: apiResult.error_type,
    } : undefined,
    error_page_detected: errorPage?.detected ?? undefined,
    error_page_sig: errorPage?.signature ?? undefined,
    note: apiDegraded ? 'API experiencing issues' : undefined,
  };
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
    const recentPosts = posts.filter(p => p.data.created_utc * 1000 > fiveMinAgo);
    const outagePosts = recentPosts.filter(p =>
      OUTAGE_KEYWORDS.some(k => p.data.title.toLowerCase().includes(k))
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
    return { ...direct, confidence: 0.9, source: 'Monitor + Community' };
  }
  if (direct.status === 'down' && reddit.status === 'up') {
    return { ...direct, status: 'up', confidence: 0.7, source: 'Community confirmed', note: 'Our probe was blocked but community reports are clear' };
  }
  return direct;
}

async function processService(env, target) {
  const kvKey = `status:${target.name}`;
  const prevRaw = await env.STATUS_KV.get(kvKey);
  const prev = prevRaw ? JSON.parse(prevRaw) : null;
  const prevStatus = prev?.status ?? 'unknown';
  const result = await checkService(target);
  const newStatus = result.status;
  const flipped = prevStatus !== newStatus && prevStatus !== 'unknown';

  const payload = {
    ...result,
    name: target.name,
    label: target.label,
    timestamp: new Date().toISOString(),
    downSince: newStatus === 'down'
      ? (prevStatus === 'down' ? prev.downSince : new Date().toISOString())
      : null,
  };

  const historyKey = `history:${target.name}`;
  const historyRaw = await env.STATUS_KV.get(historyKey);
  const history = historyRaw ? JSON.parse(historyRaw) : [];
  const lastEntry = history.length > 0 ? new Date(history[history.length - 1].t).getTime() : 0;
  if (Date.now() - lastEntry > 30 * 60 * 1000) {
    await updateHistory(env, target, payload);
  }

  if (flipped || prevStatus === 'unknown') {
    const officialStatus = await checkOfficialStatus(target);
    if (officialStatus) payload.official_status = officialStatus;

    await env.STATUS_KV.put(kvKey, JSON.stringify(payload));
    console.log(`${prevStatus === 'unknown' ? '[SEED]' : '[FLIP]'} ${target.label}: ${prevStatus} → ${newStatus}`);
  }

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
      headers: { 'Content-Type': 'application/json', 'x-tweet-secret': env.TWEET_SECRET },
      body: JSON.stringify({ text: message }),
    });
  } catch (e) {
    console.error('Tweet proxy call failed:', e.message);
  }
}

async function bustVercelCache(env, targetName) {
  if (!env.VERCEL_REVALIDATE_URL || !env.REVALIDATE_SECRET) return;
  try {
    await fetch(env.VERCEL_REVALIDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': env.REVALIDATE_SECRET,
      },
      body: JSON.stringify({ service: targetName }),
    });
  } catch (e) {
    console.error('Cache bust failed:', e.message);
  }
}

// ─── History (2.1) ─────────────────────────────────────────────────
async function updateHistory(env, target, payload) {
  const key = `history:${target.name}`;
  const raw = await env.STATUS_KV.get(key);
  const history = raw ? JSON.parse(raw) : [];
  history.push({
    t: payload.timestamp,
    ms: payload.latency_ms,
    s: payload.status === 'up' ? 1 : 0,
  });
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const trimmed = history.filter(h => h.t >= cutoff).slice(-288);
  await env.STATUS_KV.put(key, JSON.stringify(trimmed));
}

// ─── Official status (2.3) ─────────────────────────────────────────
async function checkOfficialStatus(target) {
  if (!target.officialStatusUrl) return null;
  try {
    const resp = await fetch(target.officialStatusUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'ai-status-checker/1.0' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const incidents = data?.incidents ?? [];
    const active = incidents.filter(i =>
      i.status !== 'resolved' && i.status !== 'completed'
    );
    return {
      has_incidents: active.length > 0,
      active_count: active.length,
      updated_at: data?.page?.updated_at ?? null,
      latest_incident: active[0] ? { name: active[0].name, status: active[0].status } : null,
    };
  } catch {
    return null;
  }
}

// ─── Email alerts via MailChannels (3.1) ───────────────────────────
async function sendEmailAlerts(env, target, newStatus) {
  if (!env.MAILCHANNELS_API_KEY || !env.ALERT_FROM_EMAIL) return;
  const subsKey = `subs:${target.name}`;
  const raw = await env.STATUS_KV.get(subsKey);
  if (!raw) return;
  const subs = JSON.parse(raw);
  if (!subs.length) return;

  const isDown = newStatus === 'down';
  const subject = isDown
    ? `🔴 ${target.label} is DOWN`
    : `🟢 ${target.label} is back UP`;
  const html = `<p><strong>${target.label}</strong> is ${newStatus.toUpperCase()}.</p><p><a href="https://isaidown.live/${target.name}">View live status →</a></p><p style="color:#999;font-size:12px">Unsubscribe: <a href="https://isaidown.live/unsubscribe?service=${target.name}">click here</a></p>`;

  for (const sub of subs) {
    try {
      await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': env.MAILCHANNELS_API_KEY,
        },
        body: JSON.stringify({
          from: { email: env.ALERT_FROM_EMAIL, name: 'IsAIDown Alerts' },
          to: [{ email: sub.email }],
          subject,
          html,
        }),
      });
    } catch (e) {
      console.error(`Alert email failed for ${sub.email}:`, e.message);
    }
  }
  console.log(`Sent ${subs.length} alerts for ${target.label} ${newStatus}`);
}

// ─── Webhook alerts (3.3) ──────────────────────────────────────────
async function sendWebhookAlerts(env, target, newStatus) {
  const hooksKey = `webhooks:${target.name}`;
  const raw = await env.STATUS_KV.get(hooksKey);
  if (!raw) return;
  const hooks = JSON.parse(raw);
  if (!hooks.length) return;

  const isDown = newStatus === 'down';
  const payload = {
    text: isDown
      ? `🔴 *${target.label}* is DOWN\nCheck status: https://isaidown.live/${target.name}`
      : `🟢 *${target.label}* is back UP\nhttps://isaidown.live/${target.name}`,
    attachments: [{
      color: isDown ? '#EF4444' : '#22C55E',
      title: `${target.label} Status Update`,
      title_link: `https://isaidown.live/${target.name}`,
      fields: [
        { title: 'Status', value: newStatus.toUpperCase(), short: true },
        { title: 'Time', value: new Date().toUTCString(), short: true },
      ],
    }],
  };

  for (const hook of hooks) {
    try {
      await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      console.error(`Webhook failed for ${hook.url}:`, e.message);
    }
  }
  console.log(`Fired ${hooks.length} webhooks for ${target.label}`);
}

// ─── Badge SVG (3.2) ───────────────────────────────────────────────
function badgeSvg(status, label) {
  const color = status === 'up' ? '#22C55E' : status === 'down' ? '#EF4444' : '#71717A';
  const text = status === 'up' ? 'UP' : status === 'down' ? 'DOWN' : '?';
  const labelEnc = label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <rect width="120" height="20" rx="0" fill="#18181B"/>
  <rect x="0" width="120" height="20" rx="0" fill="none" stroke="#27272A" stroke-width="1"/>
  <text x="6" y="14" font-family="Inter,sans-serif" font-size="11" fill="#A1A1AA">${labelEnc}</text>
  <rect x="80" y="2" width="36" height="16" rx="0" fill="${color}" opacity="0.15"/>
  <text x="98" y="14" font-family="Inter,sans-serif" font-size="10" font-weight="600" fill="${color}" text-anchor="middle">${text}</text>
</svg>`;
}

// ─── Report aggregation ────────────────────────────────────────────
async function getReportTotals(env, service) {
  const now = new Date();
  let totalCount = 0;
  const allCountries = {};
  const allTypes = {};

  for (let d = 0; d < 2; d++) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

    const raw = await env.STATUS_KV.get(`reports_day:${service}:${dayKey}`);
    if (raw) {
      const data = JSON.parse(raw);
      totalCount += data.count ?? 0;
      if (data.countries) {
        for (const [code, count] of Object.entries(data.countries)) {
          allCountries[code] = (allCountries[code] ?? 0) + count;
        }
      }
      if (data.types) {
        for (const [type, count] of Object.entries(data.types)) {
          allTypes[type] = (allTypes[type] ?? 0) + count;
        }
      }
    }
  }

  return { totalCount, countries: allCountries, types: allTypes };
}

const worker = {
  async scheduled(controller, env, ctx) {
    let downCount = 0;

    const results = await Promise.allSettled(
      TARGETS.map(async (target) => {
        const { flipped, prevStatus, newStatus } = await processService(env, target);
        if (flipped) {
          ctx.waitUntil(postOutageTweet(env, target, newStatus));
          ctx.waitUntil(bustVercelCache(env, target.name));
          ctx.waitUntil(sendEmailAlerts(env, target, newStatus));
          ctx.waitUntil(sendWebhookAlerts(env, target, newStatus));
        }
        if (newStatus === 'down') downCount++;
        return { target: target.name, prevStatus, newStatus, flipped };
      })
    );

    console.log(`Check complete: ${downCount}/${TARGETS.length} services down`);

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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=55',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const reportMatch = url.pathname.match(/^\/report\/(.+)$/);
    if (reportMatch && request.method === 'POST') {
      const service = reportMatch[1];
      if (!TARGETS.find(t => t.name === service)) {
        return new Response(JSON.stringify({ error: 'Unknown service' }), { status: 404, headers: corsHeaders });
      }

      const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
      const country = request.headers.get('CF-IPCountry') ?? 'XX';
      const lockKey = `report_lock:${service}:${ip}`;

      const existingLock = await env.STATUS_KV.get(lockKey);
      if (existingLock) {
        return new Response(JSON.stringify({ error: 'Already reported recently' }), { status: 429, headers: corsHeaders });
      }

      await env.STATUS_KV.put(lockKey, '1', { expirationTtl: 1800 });

      const now = new Date();
      const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
      const dayKey = `reports_day:${service}:${todayKey}`;
      const dayRaw = await env.STATUS_KV.get(dayKey);
      const dayData = dayRaw ? JSON.parse(dayRaw) : { count: 0, countries: {}, types: {} };

      let problemType = 'other';
      try {
        const body = await request.json();
        if (body.type && ['website', 'login', 'api', 'slow', 'other'].includes(body.type)) {
          problemType = body.type;
        }
      } catch { /* no body, default to other */ }

      dayData.count += 1;
      dayData.countries[country] = (dayData.countries[country] ?? 0) + 1;
      dayData.types[problemType] = (dayData.types[problemType] ?? 0) + 1;
      await env.STATUS_KV.put(dayKey, JSON.stringify(dayData), { expirationTtl: 172800 });

      const totalCount = dayData.count;

      // Also compute today's total quickly from the dayData
      // We'll pass the count back in the response


      return new Response(JSON.stringify({ ok: true, count: totalCount }), { headers: corsHeaders });
    }

    const subscribeMatch = url.pathname.match(/^\/subscribe\/(.+)$/);
    if (subscribeMatch && request.method === 'POST') {
      const service = subscribeMatch[1];
      if (!TARGETS.find(t => t.name === service)) {
        return new Response(JSON.stringify({ error: 'Unknown service' }), { status: 404, headers: corsHeaders });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
      }
      const email = body.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers: corsHeaders });
      }
      const subsKey = `subs:${service}`;
      const raw = await env.STATUS_KV.get(subsKey);
      const subs = raw ? JSON.parse(raw) : [];
      if (subs.find(s => s.email === email)) {
        return new Response(JSON.stringify({ ok: true, note: 'Already subscribed' }), { headers: corsHeaders });
      }
      subs.push({ email, subscribed_at: new Date().toISOString() });
      await env.STATUS_KV.put(subsKey, JSON.stringify(subs));
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const webhookMatch = url.pathname.match(/^\/subscribe-webhook\/(.+)$/);
    if (webhookMatch && request.method === 'POST') {
      const service = webhookMatch[1];
      if (!TARGETS.find(t => t.name === service)) {
        return new Response(JSON.stringify({ error: 'Unknown service' }), { status: 404, headers: corsHeaders });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
      }
      const webhookUrl = body.url?.trim();
      if (!webhookUrl || !webhookUrl.startsWith('https://')) {
        return new Response(JSON.stringify({ error: 'Valid HTTPS URL required' }), { status: 400, headers: corsHeaders });
      }
      const hooksKey = `webhooks:${service}`;
      const raw = await env.STATUS_KV.get(hooksKey);
      const hooks = raw ? JSON.parse(raw) : [];
      if (hooks.find(h => h.url === webhookUrl)) {
        return new Response(JSON.stringify({ ok: true, note: 'Already registered' }), { headers: corsHeaders });
      }
      hooks.push({ url: webhookUrl, added_at: new Date().toISOString() });
      await env.STATUS_KV.put(hooksKey, JSON.stringify(hooks));
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const badgeMatch = url.pathname.match(/^\/badge\/(.+)$/);
    if (badgeMatch && request.method === 'GET') {
      const serviceName = badgeMatch[1];
      const target = TARGETS.find(t => t.name === serviceName);
      if (!target) {
        return new Response(badgeSvg('unknown', '?'), {
          status: 404,
          headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=120' },
        });
      }
      const raw = await env.STATUS_KV.get(`status:${serviceName}`);
      const status = raw ? JSON.parse(raw) : { status: 'unknown' };
      return new Response(badgeSvg(status.status, target.label.replace(' AI', '')), {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' },
      });
    }

    if (url.pathname === '/status/all') {
      const all = await Promise.all(
        TARGETS.map(async (t) => {
          const raw = await env.STATUS_KV.get(`status:${t.name}`);
          const base = raw ? JSON.parse(raw) : { name: t.name, label: t.label, status: 'unknown' };
          const historyRaw = await env.STATUS_KV.get(`history:${t.name}`);
          const history = historyRaw ? JSON.parse(historyRaw) : [];
          const freshestHistory = history.length > 0 ? history[history.length - 1] : null;
          const effectiveTimestamp = freshestHistory
            ? freshestHistory.t
            : base.timestamp ?? null;
          const { totalCount: reportCount, countries, types } = await getReportTotals(env, t.name);
          return {
            ...base,
            timestamp: effectiveTimestamp,
            report_count: reportCount,
            report_countries: countries,
            report_types: types,
            history,
          };
        })
      );

      const timestamps = all
        .map(s => s.timestamp)
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));
      const checkedAt = timestamps[0] ?? null;

      return new Response(JSON.stringify({
        services: all,
        checked_at: checkedAt,
      }), { headers: corsHeaders });
    }

    const match = url.pathname.match(/^\/status\/(.+)$/);
    if (match) {
      const raw = await env.STATUS_KV.get(`status:${match[1]}`);
      if (!raw) return new Response('{"status":"unknown"}', { status: 404, headers: corsHeaders });
      const base = JSON.parse(raw);
      const historyRaw = await env.STATUS_KV.get(`history:${match[1]}`);
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      if (history.length > 0) {
        base.timestamp = history[history.length - 1].t;
      }
      return new Response(JSON.stringify(base), { headers: corsHeaders });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services_monitored: TARGETS.length,
      }), { headers: corsHeaders });
    }

    return new Response('Not found', { status: 404 });
  },
};

export default worker;
