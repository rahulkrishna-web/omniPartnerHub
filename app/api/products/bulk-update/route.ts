import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { productExchange } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
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

    const { productIds, isPublic } = await request.json();

    if (!productIds || !Array.isArray(productIds)) {
      return NextResponse.json({ error: "Invalid productIds" }, { status: 400 });
    }

    // Perform atomic bulk updates
    for (const productId of productIds) {
      await db.insert(productExchange)
        .values({ productId, isPublic })
        .onConflictDoUpdate({
          target: productExchange.productId,
          set: { isPublic }
        });
    }

    console.log(`Debug API: Bulk updated ${productIds.length} products to isPublic: ${isPublic}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json({ error: "Failed to update products" }, { status: 500 });
  }
}
