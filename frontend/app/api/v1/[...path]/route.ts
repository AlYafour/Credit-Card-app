// Allow large payloads for card image scanning (base64 images up to ~15MB)
// 300s needed for PDF chat: pre-extraction (~55s) + Claude response (~15s) + retries
export const maxDuration = 300;

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

async function proxy(request: Request, { path }: { path: string[] }) {
  const segment = path?.length ? path.join('/') + '/' : '';
  const url = new URL(request.url);
  const backendUrl = `${BACKEND}/api/v1/${segment}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'connection') return;
    headers.set(key, value);
  });

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  let res: Response;
  try {
    res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });
  } catch (err) {
    console.error('[API proxy] Backend unreachable:', err);
    return new Response(
      JSON.stringify({ detail: 'Backend unavailable. Make sure Django is running on port 8000.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  });
}
