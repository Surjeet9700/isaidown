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
    ? `🔴 ${downServices.map(s => s.label).join(', ')} DOWN — Is AI Down?`
    : '🟢 All AI Tools Up — Is AI Down? Real-Time Status Checker';

  const description = downServices.length > 0
    ? `${downServices.map(s => s.label).join(' and ')} ${downServices.length > 1 ? 'are' : 'is'} currently down. Check live status of ChatGPT, Claude, Gemini, Character AI and more. Find working alternatives.`
    : 'All major AI tools are online. Real-time uptime monitoring for ChatGPT, Claude, Gemini, Character AI, Perplexity, and more. Updated every 60 seconds.';

  return {
    title,
    description,
    openGraph: {
      title: 'Is AI Down? — Real-Time Status Checker',
      description: 'Live status monitoring for 8 major AI tools. Is ChatGPT down? Is Character AI not working? Check here.',
      siteName: 'IsAIDown.live',
    },
    alternates: { canonical: 'https://isaidown.live' },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
