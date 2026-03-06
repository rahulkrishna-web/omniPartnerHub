import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, shops } from "@/lib/db/schema";
import { eq, like } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Debug endpoint — secured by ADMIN_SECRET header.
 * Returns sessions and shop records for a given shop.
 *
 * Usage:
 *   GET /api/debug/session?shop=somberlite.myshopify.com
 *   Header: x-admin-secret: <ADMIN_SECRET value>
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing ?shop= parameter" }, { status: 400 });
  }

  // ── Sessions in DB ─────────────────────────────────────────────────────────
  const sessionRows = await db
    .select({
      id: sessions.id,
      shop: sessions.shop,
      isOnline: sessions.isOnline,
      hasAccessToken: sessions.accessToken,
      scope: sessions.scope,
      expires: sessions.expires,
    })
    .from(sessions)
    .where(like(sessions.shop, `%${shop}%`));

  // ── Shop record in DB ──────────────────────────────────────────────────────
  const shopRows = await db
    .select({
      id: shops.id,
      shop: shops.shop,
      hasAccessToken: shops.accessToken,
      isInstalled: shops.isInstalled,
      currency: shops.currency,
      scope: shops.scope,
      installedAt: shops.installedAt,
    })
    .from(shops)
    .where(like(shops.shop, `%${shop}%`));

  return NextResponse.json({
    shop,
    sessions: sessionRows.map((s) => ({
      id: s.id,
      shop: s.shop,
      isOnline: s.isOnline,
      hasAccessToken: !!s.hasAccessToken,
      scope: s.scope,
      expires: s.expires,
    })),
    shopRecords: shopRows.map((s) => ({
      id: s.id,
      shop: s.shop,
      hasAccessToken: !!s.hasAccessToken,
      isInstalled: s.isInstalled,
      currency: s.currency,
      scope: s.scope,
      installedAt: s.installedAt,
    })),
    diagnostic: {
      expectedOfflineSessionId: `offline_${shop}`,
      offlineSessionFound: sessionRows.some(
        (s) => s.id === `offline_${shop}` && !!s.hasAccessToken
      ),
      anySessionFound: sessionRows.length > 0,
      shopRecordFound: shopRows.length > 0,
    },
  });
}
