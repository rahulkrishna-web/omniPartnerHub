import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolveSession, ensureShopRecord } from "@/app/lib/shopify-session";
import { handleProductUpdate } from "@/lib/webhooks/product-handlers";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const sessionData = await resolveSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized — please reload the app" }, { status: 401 });
    }

    const shopRecord = await ensureShopRecord(sessionData);
    if (!shopRecord) {
      return NextResponse.json({ error: "Failed to initialise shop record" }, { status: 500 });
    }

    const client = new shopify.clients.Rest({ session: sessionData as any });

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
      console.error("[Sync] Failed to sync shop currency:", e);
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
  } catch (error: any) {
    // Surface real error so we can diagnose (safe for embedded app context)
    const message = error?.message || String(error);
    console.error("[Sync] Error:", error);
    return NextResponse.json({ error: `Sync failed: ${message}` }, { status: 500 });
  }
}
