import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops, hubConnections, hubOrders, sessions, walletLedger, partners } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { handleProductUpdate, handleProductDelete } from "@/lib/webhooks/product-handlers";
import { inngest } from "@/lib/inngest/client";

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

      case "inventory_levels/update":
        // Push the resource-heavy inventory sync to the Inngest background queue
        await inngest.send({
          name: "app/inventory.updated",
          data: {
            shopDomain: shop,
            inventoryItemId: payload.inventory_item_id,
            available: payload.available,
          },
        });
        break;

      case "orders/paid":
        await handleOrderPaid(shopRecord.id, shop, payload);
        break;

      case "fulfillments/create":
        await handleFulfillmentCreate(shopRecord.id, payload);
        break;

      /* GDPR Webhooks - Mandatory for App Store Approval */
      case "customers/data_request":
        console.log(`[GDPR] Customer data request for ${shop}`);
        break;

      case "customers/redact":
        console.log(`[GDPR] Customer redact request for ${shop}`);
        break;

      case "shop/redact":
        console.log(`[GDPR] Shop redact request for ${shop}`);
        // Mark shop as uninstalled in our DB
        await db.update(shops).set({ isInstalled: false, updatedAt: new Date() }).where(eq(shops.shop, shop));
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
  const supplierGroups: Record<number, {
    supplierShop: any,
    items: { connection: any, lineItem: any }[]
  }> = {};

  // 1. Group by supplier
  for (const lineItem of lineItems) {
    const variantId = String(lineItem.variant_id);
    const connection = await db.query.hubConnections.findFirst({
      where: and(
        eq(hubConnections.retailerShopId, retailerShopId),
        eq(hubConnections.retailerShopifyVariantId, variantId),
        eq(hubConnections.isActive, true)
      ),
      with: {
        supplierProduct: { with: { shop: true, exchange: true } },
      },
    });

    if (!connection) continue;
    const supplierShop = (connection.supplierProduct as any)?.shop;
    if (!supplierShop) continue;

    if (!supplierGroups[supplierShop.id]) {
      supplierGroups[supplierShop.id] = { supplierShop, items: [] };
    }
    supplierGroups[supplierShop.id].items.push({ connection, lineItem });
  }

  // 2. Process each supplier group
  for (const supplierIdKey in supplierGroups) {
    const group = supplierGroups[Number(supplierIdKey)];
    const { supplierShop, items } = group;

    // Load supplier session
    const supplierSessions = await db.select().from(sessions)
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

      const shippingAddress = order.shipping_address || order.billing_address || {};

      // Prepare Draft Order line items
      const draftLineItems = items.map(({ connection, lineItem }) => {
        const mapping = connection.variantMapping as Record<string, string>;
        const supplierVariantId = mapping ? mapping[String(lineItem.variant_id)] : null;

        const exchange = (connection.supplierProduct as any).exchange;
        const wholesalePrice = exchange?.wholesalePrice || lineItem.price;

        return {
          variant_id: supplierVariantId ? Number(supplierVariantId) : null,
          title: lineItem.title,
          price: wholesalePrice,
          quantity: lineItem.quantity,
          sku: lineItem.sku || "",
        };
      });

      // Create Draft Order
      const draftResp = await supplierClient.post({
        path: "draft_orders",
        data: {
          draft_order: {
            line_items: draftLineItems,
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

      // 3. Record entries for each item
      for (const { connection, lineItem } of items) {
        const exchange = (connection.supplierProduct as any).exchange;
        const mapping = connection.variantMapping as Record<string, string>;
        const supplierVariantId = mapping ? mapping[String(lineItem.variant_id)] : null;

        // Record Hub Order
        await db.insert(hubOrders).values({
          hubConnectionId: connection.id,
          retailerShopId,
          retailerOrderId: String(order.id),
          retailerOrderName: order.name,
          retailerLineItemId: String(lineItem.id),
          supplierShopId: supplierShop.id,
          supplierDraftOrderId: String(draftOrder.id),
          supplierVariantId: supplierVariantId,
          wholesalePrice: exchange?.wholesalePrice,
          retailPrice: lineItem.price,
          status: "ordered",
        });

        // Record Ledger Entry (Debit Retailer)
        const wholesaleTotal = (Number(exchange?.wholesalePrice || 0) * lineItem.quantity).toFixed(2);
        await db.insert(walletLedger).values({
          shopId: retailerShopId,
          type: "debit",
          amount: wholesaleTotal,
          currency: order.currency,
          referenceOrderId: String(order.id),
          description: `Wholesale cost for ${lineItem.title} (Qty: ${lineItem.quantity})`,
          status: "pending",
        });
      }

      console.log(`[OrderRouting] Completed supplier draft order ${draftOrder.id} with ${items.length} items.`);
    } catch (e) {
      console.error(`[OrderRouting] Failed for supplier ${supplierShop.shop}:`, e);
    }
  }

  // 4. Tier 1 & 2 Attribution (via cart attributes/notes)
  const noteAttributes = order.note_attributes || [];
  const partnerHandle = noteAttributes.find((attr: any) => attr.name === "partner_ref" || attr.name === "ref")?.value;

  if (partnerHandle) {
    const partner = await db.query.partners.findFirst({
      where: eq(partners.handle, partnerHandle),
    });

    if (partner) {
      // For Tier 1/2, the partner gets a commission (credit)
      // For now, we use a simple 10% calculation or check if items are in product_exchange
      let totalCommission = 0;
      for (const li of lineItems) {
        // Optional: verify if this specific product has a defined commission in product_exchange
        totalCommission += Number(li.price) * li.quantity * 0.10; // Default 10%
      }

      const commissionAmount = totalCommission.toFixed(2);
      if (Number(commissionAmount) > 0) {
        await db.insert(walletLedger).values({
          shopId: retailerShopId, // The shop where the order occurred
          partnerId: partner.id,
          type: "credit",
          amount: commissionAmount,
          currency: order.currency,
          referenceOrderId: String(order.id),
          description: `Commission for referral (Partner: ${partnerHandle})`,
          status: "pending",
        });
        console.log(`[Attribution] Credited ${commissionAmount} to partner ${partnerHandle} for order ${order.name}`);
      }
    }
  }
}

/**
 * When a supplier creates a fulfillment, find matching hub_orders and
 * propagate the tracking info to the retailer's order automatically.
 * Supports partial shipments by matching line items.
 */
async function handleFulfillmentCreate(supplierShopId: number, fulfillment: any) {
  const supplierOrderId = String(fulfillment.order_id);
  const fulfilledLineItems = fulfillment.line_items || [];

  // 1. Find hub orders associated with this supplier order
  const allRelatedHubOrders = await db.query.hubOrders.findMany({
    where: and(
      eq(hubOrders.supplierShopId, supplierShopId),
      sql`(${hubOrders.supplierOrderId} = ${supplierOrderId} OR ${hubOrders.supplierDraftOrderId} = ${supplierOrderId})`
    ),
    with: { retailerShop: true },
  });

  if (allRelatedHubOrders.length === 0) return;

  // 2. Filter to only those hub orders whose line items were actually fulfilled in this webhook
  const fulfilledHubOrders = allRelatedHubOrders.filter(ho => {
    return fulfilledLineItems.some((li: any) => String(li.variant_id) === ho.supplierVariantId);
  });

  if (fulfilledHubOrders.length === 0) {
    console.log(`[FulfillmentSync] No matching hub items in fulfillment ${fulfillment.id}`);
    return;
  }

  const trackingNumber = fulfillment.tracking_number || null;
  const trackingUrl = fulfillment.tracking_url || null;
  const trackingCompany = fulfillment.tracking_company || null;

  // 3. Group by retailer order to minimize API calls
  const retailerOrderGroups: Record<string, { 
    retailerShop: any, 
    hubOrders: typeof fulfilledHubOrders 
  }> = {};

  for (const ho of fulfilledHubOrders) {
    const retailerOrderId = ho.retailerOrderId;
    if (!retailerOrderGroups[retailerOrderId]) {
      retailerOrderGroups[retailerOrderId] = { retailerShop: ho.retailerShop, hubOrders: [] };
    }
    retailerOrderGroups[retailerOrderId].hubOrders.push(ho);
  }

  // 4. Process each retailer order
  for (const retailerOrderId in retailerOrderGroups) {
    const { retailerShop, hubOrders: itemsToFulfill } = retailerOrderGroups[retailerOrderId];

    try {
      // Load retailer session
      const retailerSessions = await db.select().from(sessions)
        .where(and(eq(sessions.shop, retailerShop.shop), eq(sessions.isOnline, false)))
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
        path: `orders/${retailerOrderId}/fulfillment_orders`,
      });
      const fulfillmentOrders = (foResp.body as any).fulfillment_orders || [];
      if (fulfillmentOrders.length === 0) continue;

      // Map our items to their fulfillment_order_id and fulfillment_order_line_item_id
      const lineItemsByFo: Record<string, any[]> = {};

      for (const ho of itemsToFulfill) {
        // Find which FO contains this retailerLineItemId
        for (const fo of fulfillmentOrders) {
          const foLineItem = fo.line_items.find((li: any) => String(li.line_item_id) === ho.retailerLineItemId);
          if (foLineItem) {
            if (!lineItemsByFo[fo.id]) lineItemsByFo[fo.id] = [];
            lineItemsByFo[fo.id].push({
              fulfillment_order_line_item_id: foLineItem.id,
              quantity: foLineItem.quantity, // Fulfill whatever is remaining/requested
            });
            break;
          }
        }
      }

      const lineItemsByFulfillmentOrder = Object.entries(lineItemsByFo).map(([foId, items]) => ({
        fulfillment_order_id: Number(foId),
        fulfillment_order_line_items: items,
      }));

      if (lineItemsByFulfillmentOrder.length === 0) continue;

      // Fulfill the retailer's order with tracking
      await retailerClient.post({
        path: "fulfillments",
        data: {
          fulfillment: {
            line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
            tracking_info: {
              number: trackingNumber,
              url: trackingUrl,
              company: trackingCompany,
            },
            notify_customer: true,
          },
        },
      });

      // Update our records
      for (const ho of itemsToFulfill) {
        await db.update(hubOrders)
          .set({
            status: "fulfilled",
            trackingNumber,
            trackingUrl,
            trackingCompany,
            updatedAt: new Date(),
          })
          .where(eq(hubOrders.id, ho.id));
      }

      console.log(`[FulfillmentSync] Partially fulfilled retailer order ${retailerOrderId} with ${itemsToFulfill.length} items.`);
    } catch (e) {
      console.error(`[FulfillmentSync] Failed for retailer order ${retailerOrderId}:`, e);
    }
  }
}
