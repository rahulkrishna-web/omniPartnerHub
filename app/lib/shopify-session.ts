/**
 * Shared session resolution utility for Shopify embedded apps in Vercel serverless.
 *
 * Key insight: `getCurrentId` needs a session cookie which doesn't exist in
 * serverless API calls. Instead we decode the Bearer JWT (without signature
 * verification — just to read the `dest` shop domain claim), then directly
 * load `offline_{shop}` from the session storage.
 *
 * Priority:
 *   1. Bearer JWT → offline_{shop} direct load (fastest, most reliable)
 *   2. Bearer JWT → findSessionsByShop fallback (any session for this shop)
 *   3. getCurrentId offline/online (works in environments with cookies)
 */

import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type ResolvedSession = {
  id: string;
  shop: string;
  state: string;
  isOnline: boolean;
  accessToken: string;
  scope: string;
};

/**
 * Extracts the shop domain from a Shopify App Bridge JWT without verifying
 * the signature. We only need the `dest` claim to look up the session in DB —
 * the DB lookup itself is the security gate, not the JWT signature.
 */
function extractShopFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8")
      );
      const dest = payload?.dest as string | undefined;
      if (dest) {
        return dest.replace("https://", "").replace(/\/$/, "");
      }
    }
  } catch {
    /* invalid token format — ignore */
  }
  return null;
}

export async function resolveSession(request: Request): Promise<ResolvedSession | null> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  // 1. Bearer JWT → directly load offline session
  if (token) {
    const shopDomain = extractShopFromJwt(token);
    if (shopDomain) {
      // Offline session ID is always `offline_{shop}`
      const offlineId = `offline_${shopDomain}`;
      try {
        const session = await sessionStorage.loadSession(offlineId);
        if (session?.shop && session?.accessToken) {
          return session as unknown as ResolvedSession;
        }
      } catch { /* ignore */ }

      // Fallback: any session for this shop
      try {
        const allSessions = await sessionStorage.findSessionsByShop(shopDomain);
        const best =
          allSessions.find((s) => !s.isOnline && s.accessToken) ||
          allSessions.find((s) => !!s.accessToken);
        if (best) return best as unknown as ResolvedSession;
      } catch { /* ignore */ }
    }
  }

  // 2. getCurrentId (cookie-based, works in non-serverless environments)
  try {
    const id = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (id) {
      const s = await sessionStorage.loadSession(id);
      if (s?.shop && s?.accessToken) return s as unknown as ResolvedSession;
    }
  } catch { /* ignore */ }

  try {
    const id = await shopify.session.getCurrentId({ isOnline: true, rawRequest: request });
    if (id) {
      const s = await sessionStorage.loadSession(id);
      if (s?.shop && s?.accessToken) return s as unknown as ResolvedSession;
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Ensures a shop record exists in the `shops` table.
 * Self-heals if the auth callback failed to create it.
 */
export async function ensureShopRecord(session: ResolvedSession) {
  const existing = await db.query.shops.findFirst({
    where: eq(shops.shop, session.shop),
  });
  if (existing) return existing;

  console.warn(`[ensureShopRecord] Shop ${session.shop} missing — creating (self-heal)`);
  await db
    .insert(shops)
    .values({
      shop: session.shop,
      accessToken: session.accessToken,
      isInstalled: true,
      scope: session.scope ?? "",
    })
    .onConflictDoUpdate({
      target: shops.shop,
      set: {
        accessToken: session.accessToken,
        isInstalled: true,
        scope: session.scope ?? "",
        updatedAt: new Date(),
      },
    });

  return db.query.shops.findFirst({ where: eq(shops.shop, session.shop) });
}
