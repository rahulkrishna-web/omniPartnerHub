import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { hubOrders, shops } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/hub/orders
 * Returns all hub dropshipping orders for the authenticated retailer shop.
 */
export async function GET(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 401 });

    const retailerShop = await db.query.shops.findFirst({
      where: eq(shops.shop, session.shop),
    });
    if (!retailerShop) return NextResponse.json({ orders: [] });

    const orders = await db.query.hubOrders.findMany({
      where: eq(hubOrders.retailerShopId, retailerShop.id),
      with: {
        connection: {
          with: {
            supplierProduct: true,
            retailerShop: true,
          },
        },
        supplierShop: true,
      },
      orderBy: [desc(hubOrders.createdAt)],
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("[HubOrders] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
