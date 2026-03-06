import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, shops, productExchange, hubConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/hub/add-to-store
 * Body: { supplierProductId: number }
 *
 * Retailer calls this to add a supplier's public hub product to their Shopify store.
 * Creates the product in the retailer's Shopify and records the hub_connection.
 */
export async function POST(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 401 });

    // Get retailer shop record
    const retailerShop = await db.query.shops.findFirst({
      where: eq(shops.shop, session.shop),
    });
    if (!retailerShop) return NextResponse.json({ error: "Retailer shop not found" }, { status: 404 });

    const { supplierProductId } = await request.json();
    if (!supplierProductId) return NextResponse.json({ error: "Missing supplierProductId" }, { status: 400 });

    // Fetch the supplier product + exchange settings
    const supplierProduct = await db.query.products.findFirst({
      where: eq(products.id, Number(supplierProductId)),
      with: { exchange: true },
    });

    if (!supplierProduct || !supplierProduct.exchange?.isPublic) {
      return NextResponse.json({ error: "Product not found or not public" }, { status: 404 });
    }

    // Check if already added by this retailer
    const existing = await db.query.hubConnections.findFirst({
      where: and(
        eq(hubConnections.supplierProductId, supplierProduct.id),
        eq(hubConnections.retailerShopId, retailerShop.id)
      ),
    });

    if (existing?.isActive) {
      return NextResponse.json({
        success: true,
        alreadyAdded: true,
        connection: existing,
      });
    }

    // Get supplier shop for currency info
    const supplierShop = await db.query.shops.findFirst({
      where: eq(shops.id, supplierProduct.shopId!),
    });

    // Create the product in the RETAILER's Shopify store
    const retailerClient = new shopify.clients.Rest({ session });
    const createResponse = await retailerClient.post({
      path: "products",
      data: {
        product: {
          title: supplierProduct.title,
          vendor: supplierProduct.vendor || supplierShop?.shop?.replace(".myshopify.com", ""),
          body_html: `<p>Sourced via OmniPartner Hub from ${supplierShop?.shop?.replace(".myshopify.com", "") || "a partner"}</p>`,
          images: supplierProduct.image ? [{ src: supplierProduct.image }] : [],
          variants: [
            {
              price: supplierProduct.exchange?.retailPrice || "0.00",
              inventory_management: null, // Retailer doesn't manage inventory
              fulfillment_service: "manual",
            },
          ],
          tags: "omnipartner-hub,dropship",
          published: false, // Start unpublished; retailer can publish manually
        },
      },
    });

    const shopifyProduct = (createResponse.body as any).product;
    const shopifyVariant = shopifyProduct?.variants?.[0];

    // Record the connection
    const [connection] = await db
      .insert(hubConnections)
      .values({
        supplierProductId: supplierProduct.id,
        retailerShopId: retailerShop.id,
        retailerShopifyProductId: String(shopifyProduct.id),
        retailerShopifyVariantId: String(shopifyVariant?.id),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [hubConnections.supplierProductId, hubConnections.retailerShopId],
        set: {
          retailerShopifyProductId: String(shopifyProduct.id),
          retailerShopifyVariantId: String(shopifyVariant?.id),
          isActive: true,
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      connection,
      shopifyProductId: shopifyProduct.id,
      message: "Product added to your store. Publish it from your Shopify admin when ready.",
    });
  } catch (error: any) {
    console.error("[AddToStore] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to add product" }, { status: 500 });
  }
}

/**
 * GET /api/hub/add-to-store?ids=1,2,3
 * Returns the hub connection status for given supplier product IDs (for the current retailer).
 * Used to show the "Added / Not Added" state on hub product cards.
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
    if (!retailerShop) return NextResponse.json({ connections: [] });

    const connections = await db.query.hubConnections.findMany({
      where: and(
        eq(hubConnections.retailerShopId, retailerShop.id),
        eq(hubConnections.isActive, true)
      ),
    });

    return NextResponse.json({ connections });
  } catch (error: any) {
    console.error("[AddToStore] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
