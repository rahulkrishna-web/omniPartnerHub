import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  let host = searchParams.get('host');

  // Auto-fix missing host param: Redirect to URL with host if shop is present
  if (shop && !host) {
     const shopName = shop.replace(".myshopify.com", "");
     const rawHost = `admin.shopify.com/store/${shopName}`;
     // manual base64 encoding (Buffer is not available in Edge runtime usually, but we can use btoa behavior if needed or a polyfill, 
     // but actually Vercel Edge supports Buffer? No.
     // We need to use standard btoa but that's for strings.
     // In Edge Middleware, we can use globalThis.btoa
     host = globalThis.btoa(rawHost).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
     
     const url = new URL(request.url);
     url.searchParams.set('host', host);
     return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self' https: data:;
    script-src 'self' https: 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com;
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
