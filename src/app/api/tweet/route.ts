import { NextRequest } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

let client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (!client) {
    client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });
  }
  return client;
}

export async function POST(req: NextRequest) {
  if (!process.env.TWITTER_API_KEY) {
    return Response.json({ error: 'Twitter not configured' }, { status: 501 });
  }

  const secret = req.headers.get('x-tweet-secret');
  if (secret !== process.env.TWEET_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text } = await req.json();
  await getClient().v2.tweet(text);
  return Response.json({ ok: true });
}
