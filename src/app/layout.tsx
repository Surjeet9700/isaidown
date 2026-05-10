import { getAllStatus, isDown } from '@/lib/status';
import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const statuses = await getAllStatus();
  const downServices = statuses.filter(isDown);

  const title = downServices.length > 0
    ? ` ${downServices.map(s => s.label).join(', ')} DOWN — Is AI Down?`
    : ' All AI Tools Up — Is AI Down? Real-Time Status Checker';

  const description = downServices.length > 0
    ? `${downServices.map(s => s.label).join(' and ')} ${downServices.length > 1 ? 'are' : 'is'} currently down. Check live status of ChatGPT, Claude, Gemini, Character AI and more. Find working alternatives.`
    : 'All major AI tools are online. Real-time uptime monitoring for ChatGPT, Claude, Gemini, Character AI, Perplexity, and more. Updated every 60 seconds.';

  return {
    title,
    description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown-live.vercel.app'),
    openGraph: {
      title: 'Is AI Down? — Real-Time Status Checker',
      description: 'Live status monitoring for 8 major AI tools. Is ChatGPT down? Is Character AI not working? Check here.',
      siteName: 'IsAIDown.live',
      images: [
        {
          url: '/brand_logo.png',
          width: 512,
          height: 512,
          alt: 'IsAIDown.live Logo',
        },
      ],
    },
    alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown-live.vercel.app'}` },
    robots: { index: true, follow: true },
    icons: {
      icon: '/brand_logo.png',
      shortcut: '/brand_logo.png',
      apple: '/brand_logo.png',
    },
    manifest: '/favicon/site.webmanifest',
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isaidown-live.vercel.app';
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "IsAIDown.live",
    "url": siteUrl,
    "description": "Real-time status monitoring for 13 major AI tools including ChatGPT, Claude, Gemini, and more. Check if AI services are down.",
    "foundingDate": "2026",
  };
  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "IsAIDown.live",
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": { "@type": "EntryPoint", "urlTemplate": `${siteUrl}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(orgSchema)}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(webSiteSchema)}} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
