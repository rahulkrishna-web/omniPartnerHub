/**
 * Shared client-side auth utilities.
 *
 * When an API call returns 401, the embedded app should redirect to the OAuth
 * flow rather than showing a dead-end error banner.
 */

/**
 * Extracts the shop domain from the App Bridge session JWT without signature
 * verification. Only used for navigation — not for granting access.
 */
export function extractShopFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      const dest = payload?.dest as string | undefined;
      if (dest) return dest.replace("https://", "").replace(/\/$/, "");
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Call this when any API call returns 401.
 * Gets the shop domain from App Bridge config or the token, then redirects
 * to /api/auth to start the OAuth flow.
 */
export async function triggerAuthRedirect(): Promise<void> {
  let shop: string | null = null;

  // 1. Try App Bridge config (most reliable in embedded context)
  try {
    if (typeof window !== "undefined" && (window as any).shopify?.config?.shop) {
      shop = (window as any).shopify.config.shop;
    }
  } catch { /* ignore */ }

  // 2. Try URL search params
  if (!shop) {
    try {
      const params = new URLSearchParams(window.location.search);
      shop = params.get("shop");
      if (!shop) {
        // Decode the 'host' param: base64url of "<shop>.myshopify.com/admin"
        const host = params.get("host");
        if (host) {
          const decoded = atob(host.replace(/-/g, "+").replace(/_/g, "/"));
          shop = decoded.split("/")[0]; // e.g. "somberlite.myshopify.com"
        }
      }
    } catch { /* ignore */ }
  }

  // 3. Decode from session token
  if (!shop) {
    try {
      const token = await (window as any).shopify.idToken();
      shop = extractShopFromToken(token);
    } catch { /* ignore */ }
  }

  if (shop) {
    console.log(`[triggerAuthRedirect] Escaping iframe to OAuth for shop="${shop}"`);
    // Crucial: Must use "_top" to break out of the App Bridge iframe, otherwise 
    // Shopify's OAuth screen gets blocked by X-Frame-Options: DENY
    window.open(`/api/auth?shop=${shop}`, "_top");
  } else {
    console.error("[triggerAuthRedirect] Could not determine shop domain for auth redirect");
  }
}

export async function getSessionToken(): Promise<string> {
  return await (window as any).shopify.idToken();
}
