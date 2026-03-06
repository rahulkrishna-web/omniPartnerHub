import { NextResponse } from "next/server";
import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveSession, ensureShopRecord } from "@/app/lib/shopify-session";

export async function GET(request: Request) {
  try {
    const session = await resolveSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure the retailer's shop record exists (self-healing for new installs)
    const retailerShop = await ensureShopRecord(session);

    // Fetch all public products with their supplier shop's currency info
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

    return NextResponse.json({
      products: publicProducts,
      currentShopId: retailerShop?.id ?? null,
    });
  } catch (error) {
    console.error("[HubProducts] Error fetching products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
