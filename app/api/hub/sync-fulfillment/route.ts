import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { hubOrders, shops, sessions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * POST /api/hub/sync-fulfillment
 *
 * Syncs fulfillment status from supplier orders to retailer orders.
 * Called manually or by a cron. For each hub_order with status "ordered",
 * we check the supplier Shopify order for fulfillment, then update the
 * retailer's Shopify order with the tracking number.
 */
export async function POST(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 401 });

    const retailerShop = await db.query.shops.findFirst({
      where: eq(shops.shop, session.shop),
    });
    if (!retailerShop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    // Get all pending/ordered hub orders for this retailer
    const pendingOrders = await db.query.hubOrders.findMany({
      where: and(
        eq(hubOrders.retailerShopId, retailerShop.id),
        inArray(hubOrders.status, ["ordered", "pending"])
      ),
      with: { supplierShop: true },
    });

    if (pendingOrders.length === 0) {
      return NextResponse.json({ message: "No pending orders to sync", synced: 0 });
    }

    let syncedCount = 0;

    for (const hubOrder of pendingOrders) {
      if (!hubOrder.supplierOrderId || !hubOrder.supplierShop) continue;

      // Load the supplier's session to make API calls on their behalf
      const supplierShopRecord = hubOrder.supplierShop;
      const supplierSessions = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.shop, supplierShopRecord.shop), eq(sessions.isOnline, false)))
        .limit(1);

      const supplierSession = supplierSessions[0];
      if (!supplierSession?.accessToken) continue;

      try {
        // Check the supplier's order for fulfillments
        const supplierClient = new shopify.clients.Rest({
          session: {
            id: supplierSession.id,
            shop: supplierSession.shop,
            state: supplierSession.state,
            isOnline: false,
            accessToken: supplierSession.accessToken || "",
            scope: supplierSession.scope || "",
          } as any,
        });

        const fulfillmentResp = await supplierClient.get({
          path: `orders/${hubOrder.supplierOrderId}/fulfillments`,
        });

        const fulfillments = (fulfillmentResp.body as any).fulfillments || [];
        const completedFulfillment = fulfillments.find(
          (f: any) => f.status === "success" || f.status === "delivered"
        );

        if (!completedFulfillment) continue;

        // Update hub_order with tracking info
        await db.update(hubOrders)
          .set({
            status: "fulfilled",
            trackingNumber: completedFulfillment.tracking_number || null,
            trackingUrl: completedFulfillment.tracking_url || null,
            trackingCompany: completedFulfillment.tracking_company || null,
            updatedAt: new Date(),
          })
          .where(eq(hubOrders.id, hubOrder.id));

        // Now fulfill the retailer's order with the same tracking info
        const retailerClient = new shopify.clients.Rest({ session });

        // First get the order's line items to find the fulfillment order
        const orderResp = await retailerClient.get({
          path: `orders/${hubOrder.retailerOrderId}/fulfillment_orders`,
        });
        const fulfillmentOrders = (orderResp.body as any).fulfillment_orders || [];
        const relevantFO = fulfillmentOrders[0]; // Simplified: first fulfillment order

        if (relevantFO) {
          await retailerClient.post({
            path: "fulfillments",
            data: {
              fulfillment: {
                line_items_by_fulfillment_order: [{ fulfillment_order_id: relevantFO.id }],
                tracking_info: {
                  number: completedFulfillment.tracking_number,
                  url: completedFulfillment.tracking_url,
                  company: completedFulfillment.tracking_company,
                },
                notify_customer: true,
              },
            },
          });
        }

        syncedCount++;
      } catch (e) {
        console.error(`[SyncFulfillment] Failed for hubOrder ${hubOrder.id}:`, e);
      }
    }

    return NextResponse.json({ success: true, synced: syncedCount });
  } catch (error: any) {
    console.error("[SyncFulfillment] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
