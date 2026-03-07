import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops, products, hubConnections, walletLedger } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 401 });

    const shopRecord = await db.query.shops.findFirst({
      where: eq(shops.shop, session.shop),
    });

    if (!shopRecord) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    // 1. Total Products
    const [productCount] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.shopId, shopRecord.id));

    // 2. Active Connections (Exchanges)
    const [connectionCount] = await db
      .select({ value: count() })
      .from(hubConnections)
      .where(
        sql`${hubConnections.retailerShopId} = ${shopRecord.id} OR ${hubConnections.supplierProductId} IN (SELECT id FROM ${products} WHERE ${products.shopId} = ${shopRecord.id})`
      );

    // 3. Wallet Balance
    const [balance] = await db
      .select({ 
        total: sql<string>`SUM(CASE WHEN ${walletLedger.type} = 'credit' THEN CAST(${walletLedger.amount} AS DECIMAL) ELSE -CAST(${walletLedger.amount} AS DECIMAL) END)` 
      })
      .from(walletLedger)
      .where(eq(walletLedger.shopId, shopRecord.id));

    return NextResponse.json({
      productCount: productCount.value,
      connectionCount: connectionCount.value,
      walletBalance: balance.total || "0.00",
      currency: shopRecord.currency,
      role: shopRecord.role,
    });
  } catch (error: any) {
    console.error("[DashboardStats] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
