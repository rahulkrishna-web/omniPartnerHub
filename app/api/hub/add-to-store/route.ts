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

    if (!supplierShop) return NextResponse.json({ error: "Supplier shop not found" }, { status: 404 });

    // 1. Load Supplier Offline Session to fetch full product details
    const supplierOfflineId = `offline_${supplierShop.shop}`;
    const supplierSession = await sessionStorage.loadSession(supplierOfflineId);
    if (!supplierSession) return NextResponse.json({ error: "Supplier session not found" }, { status: 404 });

    const supplierClient = new shopify.clients.Rest({ session: supplierSession });
    
    // Fetch full product details from supplier store
    const supplierResponse = await supplierClient.get({
      path: `products/${supplierProduct.shopifyProductId}`,
    });
    const fullSupplierProduct: any = (supplierResponse.body as any).product;

    if (!fullSupplierProduct) {
      return NextResponse.json({ error: "Origin product not found on supplier store" }, { status: 404 });
    }

    // 2. Prepare Retailer Product Payload
    // Strip IDs from supplier product to create a new one
    const newProductPayload = {
      title: fullSupplierProduct.title,
      body_html: fullSupplierProduct.body_html, // Keep original description
      vendor: fullSupplierProduct.vendor || supplierShop.shop.replace(".myshopify.com", ""),
      product_type: fullSupplierProduct.product_type,
      tags: (fullSupplierProduct.tags ? fullSupplierProduct.tags + ", " : "") + "omnipartner-hub,dropship",
      options: fullSupplierProduct.options.map((opt: any) => ({
        name: opt.name,
        values: opt.values,
      })),
      images: fullSupplierProduct.images?.map((img: any) => ({
        src: img.src,
        alt: img.alt,
      })) || [],
      variants: fullSupplierProduct.variants.map((v: any) => ({
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        price: v.price,
        compare_at_price: v.compare_at_price,
        weight: v.weight,
        weight_unit: v.weight_unit,
        inventory_management: v.inventory_management || "shopify", // Track inventory like supplier
        inventory_policy: v.inventory_policy || "deny",
        fulfillment_service: "manual",
        requires_shipping: v.requires_shipping,
      })),
      published: false, // Start unpublished so they can review it
    };

    // 3. Create the product in the RETAILER's Shopify store
    const retailerClient = new shopify.clients.Rest({ session });
    const createResponse = await retailerClient.post({
      path: "products",
      data: {
        product: newProductPayload,
      },
    });

    const shopifyProduct = (createResponse.body as any).product;
    const shopifyVariantFirst = shopifyProduct?.variants?.[0];

    // 4. Map Variant IDs and Inventory Item IDs between Supplier and Retailer
    const variantMapping: Record<string, string> = {};
    const inventoryItemMapping: Record<string, string> = {};

    if (shopifyProduct.variants && fullSupplierProduct.variants) {
      for (let i = 0; i < shopifyProduct.variants.length; i++) {
        // Since we created them in the exact same order, index mapping works perfectly
        const retailerVariantId = String(shopifyProduct.variants[i].id);
        const supplierVariantId = String(fullSupplierProduct.variants[i].id);
        if (retailerVariantId && supplierVariantId) {
          variantMapping[retailerVariantId] = supplierVariantId;
        }

        const retailerInventoryId = String(shopifyProduct.variants[i].inventory_item_id);
        const supplierInventoryId = String(fullSupplierProduct.variants[i].inventory_item_id);
        if (retailerInventoryId && supplierInventoryId && retailerInventoryId !== "undefined" && supplierInventoryId !== "undefined") {
          inventoryItemMapping[retailerInventoryId] = supplierInventoryId;
        }
      }
    }

    // 5. Record the connection with variant mappings
    const [connection] = await db
      .insert(hubConnections)
      .values({
        supplierProductId: supplierProduct.id,
        retailerShopId: retailerShop.id,
        retailerShopifyProductId: String(shopifyProduct.id),
        retailerShopifyVariantId: String(shopifyVariantFirst?.id),
        variantMapping,
        inventoryItemMapping,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [hubConnections.supplierProductId, hubConnections.retailerShopId],
        set: {
          retailerShopifyProductId: String(shopifyProduct.id),
          retailerShopifyVariantId: String(shopifyVariantFirst?.id),
          variantMapping,
          inventoryItemMapping,
          isActive: true,
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      connection,
      shopifyProductId: shopifyProduct.id,
      message: "Product cloned to your store. Publish it from your Shopify admin when ready.",
    });
  } catch (error: any) {
    console.error("[AddToStore] Error:", error?.response?.body?.errors || error);
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
