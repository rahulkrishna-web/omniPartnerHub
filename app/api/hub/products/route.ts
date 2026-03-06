import { NextResponse } from "next/server";
import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: request,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all products that are marked as public
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
      })
      .from(products)
      .innerJoin(productExchange, eq(products.id, productExchange.productId))
      .innerJoin(shops, eq(products.shopId, shops.id))
      .where(eq(productExchange.isPublic, true));

    return NextResponse.json({ products: publicProducts });
  } catch (error) {
    console.error("Error fetching hub products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
