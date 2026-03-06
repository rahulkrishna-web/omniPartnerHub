import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { handleProductUpdate } from "@/lib/webhooks/product-handlers";

/**
 * Resolves a Shopify session from a request, trying offline then online then Bearer JWT.
 * Returns both the session and the shop domain.
 */
async function resolveSession(request: Request) {
  const authHeader = request.headers.get("Authorization");

  // 1. Try offline session (preferred — has long-lived access token)
  try {
    const offlineId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (offlineId) {
      const session = await sessionStorage.loadSession(offlineId);
      if (session?.shop && session?.accessToken) return session;
    }
  } catch { /* ignore */ }

  // 2. Try online session (common right after first install)
  try {
    const onlineId = await shopify.session.getCurrentId({ isOnline: true, rawRequest: request });
    if (onlineId) {
      const session = await sessionStorage.loadSession(onlineId);
      if (session?.shop && session?.accessToken) return session;
    }
  } catch { /* ignore */ }

  // 3. Decode Bearer JWT to get shop domain and find any stored session
  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = await shopify.session.decodeSessionToken(token);
      const shopDomain = (payload as any)?.dest?.replace("https://", "");
      if (shopDomain) {
        // Try to find any session for this shop
        const { sessions } = await import("@/lib/db/schema");
        const { and } = await import("drizzle-orm");
        const rows = await db.select().from(sessions)
          .where(eq(sessions.shop, shopDomain))
          .limit(1);
        if (rows[0]?.accessToken) {
          return {
            id: rows[0].id,
            shop: rows[0].shop,
            state: rows[0].state,
            isOnline: rows[0].isOnline ?? false,
            accessToken: rows[0].accessToken,
            scope: rows[0].scope ?? "",
          } as any;
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const sessionData = await resolveSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized — please reload the app" }, { status: 401 });
    }

    const shop = sessionData.shop;

    // Self-healing: upsert the shop record in case the auth callback missed it
    // (e.g. if webhook registration threw before the DB insert ran)
    let shopRecord = await db.query.shops.findFirst({ where: eq(shops.shop, shop) });

    if (!shopRecord) {
      console.warn(`[Sync] Shop ${shop} not in DB — creating record (self-heal)`);
      await db.insert(shops).values({
        shop,
        accessToken: sessionData.accessToken,
        isInstalled: true,
        scope: sessionData.scope || "",
      }).onConflictDoUpdate({
        target: shops.shop,
        set: {
          accessToken: sessionData.accessToken,
          isInstalled: true,
          scope: sessionData.scope || "",
          updatedAt: new Date(),
        },
      });
      shopRecord = await db.query.shops.findFirst({ where: eq(shops.shop, shop) });
    }

    if (!shopRecord) {
      return NextResponse.json({ error: "Failed to initialise shop record" }, { status: 500 });
    }

    const client = new shopify.clients.Rest({ session: sessionData });

    // 1. Fetch shop details for currency/locale
    try {
      const shopResponse = await client.get({ path: "shop" });
      const shopInfo = (shopResponse.body as any).shop;
      if (shopInfo) {
        await db.update(shops)
          .set({ currency: shopInfo.currency, moneyFormat: shopInfo.money_format })
          .where(eq(shops.id, shopRecord.id));
      }
    } catch (e) {
      console.error("[Sync] Failed to sync shop currency details:", e);
    }

    // 2. Fetch all products with pagination (Shopify limit is 250 per page)
    let allProducts: any[] = [];
    let pageInfo: string | null = null;

    do {
      const query: Record<string, string | number> = { limit: 250 };
      if (pageInfo) query.page_info = pageInfo;

      const response = await client.get({ path: "products", query });
      const batch = (response.body as any).products ?? [];
      allProducts = allProducts.concat(batch);

      const linkHeader = (response.headers as any)?.get?.("link") ?? "";
      const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      pageInfo = nextMatch ? nextMatch[1] : null;
    } while (pageInfo);

    let count = 0;
    for (const product of allProducts) {
      await handleProductUpdate(shopRecord.id, product);
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("[Sync] Error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
