import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops, hubConnections, hubOrders, sessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { handleProductUpdate, handleProductDelete } from "@/lib/webhooks/product-handlers";

export async function POST(request: Request) {
  const topic = request.headers.get("X-Shopify-Topic") || "";
  const shop = request.headers.get("X-Shopify-Shop-Domain") || "";

  if (!topic || !shop) {
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const rawBody = await request.text();

  // Verify Shopify HMAC signature to ensure authenticity
  const { valid } = await shopify.webhooks.validate({ rawBody, rawRequest: request });
  if (!valid) {
    console.error(`[Webhooks] Invalid HMAC for topic "${topic}" from shop "${shop}"`);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  try {
    const shopRecords = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
    const shopRecord = shopRecords[0];

    if (!shopRecord) {
      console.error(`[Webhooks] Shop not found: ${shop}`);
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    switch (topic) {
      case "products/update":
      case "products/create":
        await handleProductUpdate(shopRecord.id, payload);
        break;

      case "products/delete":
        await handleProductDelete(shopRecord.id, payload);
        break;

      case "orders/paid":
        await handleOrderPaid(shopRecord.id, shop, payload);
        break;

      case "fulfillments/create":
        await handleFulfillmentCreate(shopRecord.id, payload);
        break;

      default:
        console.warn(`[Webhooks] Unhandled topic received: ${topic}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhooks] Processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

/**
 * When a retailer's order is paid, check each line item against hub_connections.
 * For any match, create a draft order on the supplier's Shopify store.
 */
async function handleOrderPaid(retailerShopId: number, retailerShopDomain: string, order: any) {
  const lineItems = order.line_items || [];

  for (const lineItem of lineItems) {
    const variantId = String(lineItem.variant_id);

    // Find a matching hub connection for this variant
    const connection = await db.query.hubConnections.findFirst({
      where: and(
        eq(hubConnections.retailerShopId, retailerShopId),
        eq(hubConnections.retailerShopifyVariantId, variantId),
        eq(hubConnections.isActive, true)
      ),
      with: {
        supplierProduct: { with: { shop: true } },
        retailerShop: true,
      },
    });

    if (!connection) continue;

    const supplierShop = (connection.supplierProduct as any)?.shop;
    if (!supplierShop) continue;

    // Load supplier session
    const supplierSessions = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.shop, supplierShop.shop), eq(sessions.isOnline, false)))
      .limit(1);

    const supplierSession = supplierSessions[0];
    if (!supplierSession?.accessToken) {
      console.error(`[OrderRouting] No session for supplier: ${supplierShop.shop}`);
      continue;
    }

    try {
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

      // Build shipping address from retailer order
      const shippingAddress = order.shipping_address || order.billing_address || {};

      // Create draft order on supplier Shopify
      const draftResp = await supplierClient.post({
        path: "draft_orders",
        data: {
          draft_order: {
            line_items: [
              {
                variant_id: null, // find by product ID on supplier side
                title: lineItem.title,
                price: lineItem.price,
                quantity: lineItem.quantity,
                sku: lineItem.sku || "",
              },
            ],
            shipping_address: {
              first_name: shippingAddress.first_name || order.customer?.first_name || "Dropship",
              last_name: shippingAddress.last_name || order.customer?.last_name || "Customer",
              address1: shippingAddress.address1 || "",
              city: shippingAddress.city || "",
              province: shippingAddress.province || "",
              country: shippingAddress.country || "",
              zip: shippingAddress.zip || "",
              phone: shippingAddress.phone || "",
            },
            note: `Dropship order from ${retailerShopDomain}. Retailer Order: ${order.name}`,
            tags: "dropship,omnipartner-hub",
            send_invoice: false,
          },
        },
      });

      const draftOrder = (draftResp.body as any).draft_order;

      // Record the hub order
      await db.insert(hubOrders).values({
        hubConnectionId: connection.id,
        retailerShopId,
        retailerOrderId: String(order.id),
        retailerOrderName: order.name,
        retailerLineItemId: String(lineItem.id),
        supplierShopId: supplierShop.id,
        supplierDraftOrderId: String(draftOrder.id),
        status: "ordered",
      });

      console.log(`[OrderRouting] Created supplier draft order ${draftOrder.id} for retailer order ${order.name}`);
    } catch (e) {
      console.error(`[OrderRouting] Failed to create supplier order for line item ${lineItem.id}:`, e);
    }
  }
}

/**
 * When a supplier creates a fulfillment, find matching hub_orders and
 * propagate the tracking info to the retailer's order automatically.
 */
async function handleFulfillmentCreate(supplierShopId: number, fulfillment: any) {
  const supplierOrderId = String(fulfillment.order_id);

  // Find hub orders matching this supplier order
  const matchingHubOrders = await db.query.hubOrders.findMany({
    where: and(
      eq(hubOrders.supplierShopId, supplierShopId),
      eq(hubOrders.supplierOrderId, supplierOrderId)
    ),
    with: { retailerShop: true },
  });

  // Also check by draft order ID since the supplier might have completed the draft
  if (matchingHubOrders.length === 0) {
    const byDraft = await db.query.hubOrders.findMany({
      where: and(
        eq(hubOrders.supplierShopId, supplierShopId),
        eq(hubOrders.supplierDraftOrderId, supplierOrderId)
      ),
      with: { retailerShop: true },
    });
    matchingHubOrders.push(...byDraft);
  }

  if (matchingHubOrders.length === 0) return;

  const trackingNumber = fulfillment.tracking_number || null;
  const trackingUrl = fulfillment.tracking_url || null;
  const trackingCompany = fulfillment.tracking_company || null;

  for (const hubOrder of matchingHubOrders) {
    try {
      // Update our hub_orders record
      await db.update(hubOrders)
        .set({
          status: "fulfilled",
          trackingNumber,
          trackingUrl,
          trackingCompany,
          updatedAt: new Date(),
        })
        .where(eq(hubOrders.id, hubOrder.id));

      // Load retailer session
      const retailerSessions = await db
        .select()
        .from(sessions)
        .where(and(
          eq(sessions.shop, (hubOrder.retailerShop as any).shop),
          eq(sessions.isOnline, false)
        ))
        .limit(1);

      const retailerSession = retailerSessions[0];
      if (!retailerSession?.accessToken) continue;

      const retailerClient = new shopify.clients.Rest({
        session: {
          id: retailerSession.id,
          shop: retailerSession.shop,
          state: retailerSession.state,
          isOnline: false,
          accessToken: retailerSession.accessToken || "",
          scope: retailerSession.scope || "",
        } as any,
      });

      // Get fulfillment orders for the retailer's order
      const foResp = await retailerClient.get({
        path: `orders/${hubOrder.retailerOrderId}/fulfillment_orders`,
      });
      const fulfillmentOrders = (foResp.body as any).fulfillment_orders || [];
      if (fulfillmentOrders.length === 0) continue;

      // Fulfill the retailer's order with tracking
      await retailerClient.post({
        path: "fulfillments",
        data: {
          fulfillment: {
            line_items_by_fulfillment_order: [
              { fulfillment_order_id: fulfillmentOrders[0].id },
            ],
            tracking_info: {
              number: trackingNumber,
              url: trackingUrl,
              company: trackingCompany,
            },
            notify_customer: true,
          },
        },
      });

      console.log(`[FulfillmentSync] Fulfilled retailer order ${hubOrder.retailerOrderId} with tracking ${trackingNumber}`);
    } catch (e) {
      console.error(`[FulfillmentSync] Failed for hubOrder ${hubOrder.id}:`, e);
    }
  }
}
