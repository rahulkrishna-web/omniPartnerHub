import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    // Use offline session (standard for server-side API calls in embedded apps)
    const sessionId = await shopify.session.getCurrentId({
      isOnline: false,
      rawRequest: request,
    });

    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // Fetch all public products along with their supplier shop's currency info
    const publicProducts = await db
      .select({
        id: products.id,
        shopifyProductId: products.shopifyProductId,
        title: products.title,
        image: products.image,
        vendor: products.vendor,
        wholesalePrice: productExchange.wholesalePrice,
        retailPrice: productExchange.retailPrice,
        commissionPercent: productExchange.commissionPercent,
        commissionFlat: productExchange.commissionFlat,
        supplierShop: shops.shop,
        supplierShopId: shops.id,
        supplierCurrency: shops.currency,
        supplierMoneyFormat: shops.moneyFormat,
      })
      .from(products)
      .innerJoin(productExchange, eq(products.id, productExchange.productId))
      .innerJoin(shops, eq(products.shopId, shops.id))
      .where(eq(productExchange.isPublic, true));

    // Use the already-loaded session to identify the current shop
    const currentShop = session.shop;

    const retailerShop = await db.query.shops.findFirst({
      where: eq(shops.shop, currentShop),
    });

    return NextResponse.json({
      products: publicProducts,
      currentShopId: retailerShop?.id ?? null,
    });
  } catch (error) {
    console.error("[HubProducts] Error fetching products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
