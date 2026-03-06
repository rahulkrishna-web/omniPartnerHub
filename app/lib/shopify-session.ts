/**
 * Shared session resolution utility.
 *
 * Priority:
 *   1. Offline session            (preferred — long-lived, for API calls)
 *   2. Online session             (common right after fresh install)
 *   3. Bearer JWT → findSessionsByShop (last resort via DrizzleSessionStorage)
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

export async function resolveSession(request: Request): Promise<ResolvedSession | null> {
  const authHeader = request.headers.get("Authorization");

  // 1. Offline session
  try {
    const id = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (id) {
      const s = await sessionStorage.loadSession(id);
      if (s?.shop && s?.accessToken) return s as unknown as ResolvedSession;
    }
  } catch { /* ignore */ }

  // 2. Online session
  try {
    const id = await shopify.session.getCurrentId({ isOnline: true, rawRequest: request });
    if (id) {
      const s = await sessionStorage.loadSession(id);
      if (s?.shop && s?.accessToken) return s as unknown as ResolvedSession;
    }
  } catch { /* ignore */ }

  // 3. Bearer JWT → findSessionsByShop (uses the existing DrizzleSessionStorage helper)
  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = await shopify.session.decodeSessionToken(token);
      const shopDomain = (payload as any)?.dest?.replace("https://", "");
      if (shopDomain) {
        // Use findSessionsByShop which is already available on sessionStorage
        const allSessions = await sessionStorage.findSessionsByShop(shopDomain);
        if (allSessions.length > 0) {
          // Prefer offline sessions (isOnline=false), fall back to online
          const best =
            allSessions.find((s) => !s.isOnline && s.accessToken) ||
            allSessions.find((s) => s.accessToken);
          if (best) return best as unknown as ResolvedSession;
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

/**
 * Self-healing shop upsert.
 * Ensures a shop record exists in the DB for the given session,
 * even if the auth callback failed to create it.
 */
export async function ensureShopRecord(session: ResolvedSession) {
  const existing = await db.query.shops.findFirst({ where: eq(shops.shop, session.shop) });
  if (existing) return existing;

  console.warn(`[ensureShopRecord] Shop ${session.shop} not in DB — creating (self-heal)`);
  await db.insert(shops).values({
    shop: session.shop,
    accessToken: session.accessToken,
    isInstalled: true,
    scope: session.scope ?? "",
  }).onConflictDoUpdate({
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
