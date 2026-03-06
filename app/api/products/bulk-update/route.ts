import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // Get shop for ownership verification
    const shopRecord = await db.query.shops.findFirst({
      where: eq(shops.shop, session.shop),
    });
    if (!shopRecord) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const { productIds, isPublic } = await request.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Invalid productIds" }, { status: 400 });
    }

    const numericIds = productIds.map(Number);

    // Verify all products belong to this shop before updating
    const ownedProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(and(
        eq(products.shopId, shopRecord.id),
        inArray(products.id, numericIds)
      ));

    const ownedIds = ownedProducts.map((p) => p.id);

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No valid products found" }, { status: 403 });
    }

    // Build upsert values for all owned products at once
    // Use a single loop with independent upserts (Drizzle doesn't support bulk upsert natively with different per-row values)
    // But since all products get the same isPublic value, we can do a batch update
    await db
      .update(productExchange)
      .set({ isPublic })
      .where(inArray(productExchange.productId, ownedIds));

    // For products that don't have an exchange record yet, insert them
    const existingExchanges = await db
      .select({ productId: productExchange.productId })
      .from(productExchange)
      .where(inArray(productExchange.productId, ownedIds));

    const existingIds = existingExchanges.map((e) => e.productId);
    const missingIds = ownedIds.filter((id) => !existingIds.includes(id));

    if (missingIds.length > 0) {
      await db.insert(productExchange).values(
        missingIds.map((productId) => ({ productId, isPublic }))
      );
    }

    return NextResponse.json({ success: true, updated: ownedIds.length });
  } catch (error) {
    console.error("[BulkUpdate] Error:", error);
    return NextResponse.json({ error: "Failed to update products" }, { status: 500 });
  }
}
