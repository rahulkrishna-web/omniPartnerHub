import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { handleProductUpdate } from "@/lib/webhooks/product-handlers";

export async function POST(request: Request) {
  try {
    // Fix: single getCurrentId call (previously called twice)
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionData = await sessionStorage.loadSession(sessionId);
    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const shop = sessionData.shop;
    const shopRecord = await db.query.shops.findFirst({
      where: eq(shops.shop, shop),
    });

    if (!shopRecord) {
      return NextResponse.json({ error: "Shop not found in DB" }, { status: 404 });
    }

    const client = new shopify.clients.Rest({ session: sessionData });

    // 1. Fetch Shop details to get currency/locale
    try {
      const shopResponse = await client.get({ path: "shop" });
      const shopInfo = (shopResponse.body as any).shop;
      if (shopInfo) {
        await db.update(shops)
          .set({
            currency: shopInfo.currency,
            moneyFormat: shopInfo.money_format,
          })
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

      // Parse next page cursor from Link header
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
