import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { handleProductUpdate } from "@/lib/webhooks/product-handlers";

export async function POST(request: Request) {
  try {
    const session = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    const sessionData = await sessionStorage.loadSession(sessionId!);

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

    // Fetch all products from Shopify
    // Pagination handling not implemented for MVP, fetches first 50
    const client = new shopify.clients.Rest({ session: sessionData });
    const response = await client.get({
      path: "products",
      query: { limit: 50 },
    });

    const products = (response.body as any).products;

    let count = 0;
    for (const product of products) {
      await handleProductUpdate(shopRecord.id, product);
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
