import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidatePath('/', 'layout');

  let service: string | null = null;
  try {
    const body = await req.json();
    service = body.service ?? null;
  } catch {
    // no body, just revalidate home
  }

  if (service) {
    revalidatePath(`/${service}`, 'page');
  }

  return Response.json({ revalidated: true, path: service ? `/${service}` : '/', ts: Date.now() });
}
