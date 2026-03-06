/**
 * Shared session resolution utility.
 *
 * Shopify embedded apps may present a session as an offline token, online token,
 * or a Bearer JWT (from window.shopify.idToken()). This helper tries all three
 * in priority order so every route works regardless of which type is presented.
 *
 * Priority:
 *   1. Offline session            (preferred — long-lived, for API calls)
 *   2. Online session             (common right after fresh install)
 *   3. Bearer JWT → DB lookup     (last resort)
 */

import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
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
      if (s?.shop && s?.accessToken) return s as ResolvedSession;
    }
  } catch { /* ignore */ }

  // 2. Online session
  try {
    const id = await shopify.session.getCurrentId({ isOnline: true, rawRequest: request });
    if (id) {
      const s = await sessionStorage.loadSession(id);
      if (s?.shop && s?.accessToken) return s as ResolvedSession;
    }
  } catch { /* ignore */ }

  // 3. Bearer JWT → find any stored session for that shop
  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = await shopify.session.decodeSessionToken(token);
      const shopDomain = (payload as any)?.dest?.replace("https://", "");
      if (shopDomain) {
        const rows = await db.select().from(sessions)
          .where(eq(sessions.shop, shopDomain))
          .orderBy(sessions.isOnline) // offline (false < true) first
          .limit(1);
        const row = rows[0];
        if (row?.accessToken) {
          return {
            id: row.id,
            shop: row.shop,
            state: row.state,
            isOnline: row.isOnline ?? false,
            accessToken: row.accessToken,
            scope: row.scope ?? "",
          };
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
  const { shops } = await import("@/lib/db/schema");
  const existing = await db.query.shops.findFirst({ where: eq(shops.shop, session.shop) });
  if (existing) return existing;

  console.warn(`[ensureShopRecord] Shop ${session.shop} not in DB — creating (self-heal)`);
  await db.insert(shops).values({
    shop: session.shop,
    accessToken: session.accessToken,
    isInstalled: true,
    scope: session.scope,
  }).onConflictDoUpdate({
    target: shops.shop,
    set: {
      accessToken: session.accessToken,
      isInstalled: true,
      scope: session.scope,
      updatedAt: new Date(),
    },
  });

  return db.query.shops.findFirst({ where: eq(shops.shop, session.shop) });
}
