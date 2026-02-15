import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');

  // If we have a shop but no host, and we are not in the auth flow,
  // we might need to redirect to auth to ensure we get the full params from Shopify.
  // HOWEVER, simplified:
  // If we are hitting the root / and missing host, we might be in trouble.
  // But wait, if we are in admin, Shopify sends host.
  // If we are missing host, it means we are outside admin OR next.js stripped it?
  
  // Actually, creating a middleware that just logs for now to Vercel logs is best step 1.
  // But to fix the issue:
  // We ensure strictly that we don't strip params. Next.js doesn't do it by default.
  
  // Let's implement a basic CSP header setting here as well, as some browsers block iframes without it.
  
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self' https: data:;
    script-src 'self' https: 'unsafe-inline' 'unsafe-eval';
    style-src 'self' https: 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data: https:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors https://admin.shopify.com https://*.myshopify.com https://*.spin.dev;
    block-all-mixed-content;
    upgrade-insecure-requests;
  `;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim());

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim());

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
