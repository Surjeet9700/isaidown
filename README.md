# IsAIDown.live

Real-time status monitoring for 8 major AI tools. Built with Next.js + Cloudflare Workers.

Stack: Next.js 16 (ISR), Cloudflare Workers + KV, Tailwind CSS v4, lucide-react.

## Structure

```
isaidown/
├── src/                  Next.js App Router
│   ├── app/              Pages, layouts, API routes
│   ├── components/       UI components
│   └── lib/              API client & types
├── worker/               Cloudflare Worker
│   └── src/index.js      Cron pinger + status API
├── DESIGN.md             Design system tokens
└── implementation_v2.md  Build guide
```

## Deploy

```bash
# Worker
cd worker && npx wrangler deploy

# Frontend (Vercel)
vercel --prod
```

Set `WORKER_URL` and `REVALIDATE_SECRET` in Vercel env vars.
