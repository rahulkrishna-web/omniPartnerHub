/**
 * Shared session resolution utility for Shopify embedded apps in Vercel serverless.
 *
 * DIAGNOSTIC MODE: All steps log to console so you can trace failures in Vercel logs.
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

function extractShopFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8")
      );
      const dest = payload?.dest as string | undefined;
      if (dest) {
        const shop = dest.replace("https://", "").replace(/\/$/, "");
        console.log(`[resolveSession] JWT decoded → shop="${shop}"`);
        return shop;
      }
      console.warn("[resolveSession] JWT decoded but no 'dest' claim found", JSON.stringify(payload).slice(0, 200));
    }
  } catch (e: any) {
    console.error("[resolveSession] JWT decode failed:", e?.message);
  }
  return null;
}

export async function resolveSession(request: Request): Promise<ResolvedSession | null> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  const path = new URL(request.url).pathname;

  console.log(`[resolveSession] ${path} — hasToken=${!!token} tokenLength=${token?.length ?? 0}`);

  // ── Step 1: Bearer JWT → offline session load ─────────────────────────────
  if (token) {
    const shopDomain = extractShopFromJwt(token);
    if (shopDomain) {
      const offlineId = `offline_${shopDomain}`;
      console.log(`[resolveSession] Trying offline session id="${offlineId}"`);

      try {
        const session = await sessionStorage.loadSession(offlineId);
        if (session?.shop && session?.accessToken) {
          console.log(`[resolveSession] ✅ Step1: loaded offline session for shop="${session.shop}"`);
          return session as unknown as ResolvedSession;
        }
        console.warn(`[resolveSession] ⚠️  Step1: offline session found but has no accessToken. shop="${session?.shop}" accessToken=${!!session?.accessToken}`);
      } catch (e: any) {
        console.error("[resolveSession] ❌ Step1: loadSession threw:", e?.message);
      }

      // ── Step 2: findSessionsByShop ───────────────────────────────────────
      console.log(`[resolveSession] Trying findSessionsByShop("${shopDomain}")`);
      try {
        const allSessions = await sessionStorage.findSessionsByShop(shopDomain);
        console.log(`[resolveSession] findSessionsByShop returned ${allSessions.length} sessions:`,
          allSessions.map((s) => `id=${s.id} isOnline=${s.isOnline} hasToken=${!!s.accessToken}`)
        );
        const best =
          allSessions.find((s) => !s.isOnline && s.accessToken) ||
          allSessions.find((s) => !!s.accessToken);
        if (best) {
          console.log(`[resolveSession] ✅ Step2: using session id="${best.id}"`);
          return best as unknown as ResolvedSession;
        }
        console.warn("[resolveSession] ⚠️  Step2: no sessions with accessToken found");
      } catch (e: any) {
        console.error("[resolveSession] ❌ Step2: findSessionsByShop threw:", e?.message);
      }
    } else {
      console.warn("[resolveSession] ⚠️  Could not extract shopDomain from JWT — token might not be a Shopify session token");
    }
  } else {
    console.warn("[resolveSession] ⚠️  No Authorization header present");
  }

  // ── Step 3: getCurrentId fallbacks (cookie-based) ─────────────────────────
  for (const isOnline of [false, true]) {
    try {
      const id = await shopify.session.getCurrentId({ isOnline, rawRequest: request });
      console.log(`[resolveSession] getCurrentId(isOnline=${isOnline}) → id="${id}"`);
      if (id) {
        const s = await sessionStorage.loadSession(id);
        if (s?.shop && s?.accessToken) {
          console.log(`[resolveSession] ✅ Step3: loaded session from getCurrentId(isOnline=${isOnline})`);
          return s as unknown as ResolvedSession;
        }
      }
    } catch (e: any) {
      console.error(`[resolveSession] ❌ Step3 getCurrentId(isOnline=${isOnline}) threw:`, e?.message);
    }
  }

  console.error("[resolveSession] ❌ All session resolution steps failed — returning null");
  return null;
}

/**
 * Self-healing shop upsert.
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
