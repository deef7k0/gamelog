/** Shared HTTP helpers for the gaming-account Edge Functions. */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function preflight(): Response {
  return new Response('ok', { headers: CORS_HEADERS });
}

/**
 * A minimal HTML page for the end of the OpenID round trip.
 *
 * The browser tab that Steam redirects into cannot be closed by a bare 302 to a
 * custom scheme on every Android version, so the page both attempts the deep
 * link and tells the user what happened if it does not fire.
 */
export function closingPage(deepLink: string, message: string): Response {
  const escaped = deepLink.replace(/"/g, '&quot;');
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GameLog</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;background:#0F1115;color:#F2F3F7;
       display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}
  a{color:#3B82F6}
</style></head>
<body><div>
  <p>${message}</p>
  <p><a href="${escaped}">Return to GameLog</a></p>
</div>
<script>location.replace(${JSON.stringify(deepLink)});</script>
</body></html>`,
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
