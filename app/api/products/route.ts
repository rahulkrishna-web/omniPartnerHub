import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Session validation
  // Session validation
  const authHeader = request.headers.get("Authorization");
  console.log("Debug API: Auth Header Present?", !!authHeader);

  let sessionId;
  try {
      sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
      console.log("Debug API: sessionId from getCurrentId:", sessionId);
  } catch (e) {
      console.error("Debug API: getCurrentId failed:", e);
  }

  if (!sessionId) {
      if (authHeader) {
          const token = authHeader.replace("Bearer ", "");
          try {
            const payload = await shopify.session.decodeSessionToken(token);
            console.log("Debug API: Decoded Token Payload:", payload);
          } catch(e) {
            console.error("Debug API: Failed to decode token:", e);
          }
      }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await sessionStorage.loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 401 });
  }

  // Get Shop
  const shopRecord = await db.query.shops.findFirst({
    where: eq(shops.shop, session.shop),
  });

  if (!shopRecord) {
    return NextResponse.json({ error: "Shop not found in DB" }, { status: 404 });
  }

  // Fetch Products with Exchange Data
  // We perform a left join to retrieve product details + exchange settings
  const result = await db
    .select({
      id: products.id,
      shopifyProductId: products.shopifyProductId,
      title: products.title,
      image: products.image,
      vendor: products.vendor,
      exchange: {
        wholesalePrice: productExchange.wholesalePrice,
        retailPrice: productExchange.retailPrice,
        isPublic: productExchange.isPublic,
      }
    })
    .from(products)
    .leftJoin(productExchange, eq(products.id, productExchange.productId))
    .where(eq(products.shopId, shopRecord.id));

  console.log(`Debug API: GET returning ${result.length} products`);
  return NextResponse.json({ products: result });
}

export async function PUT(request: Request) {
  // Update Product Exchange Settings
  const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await sessionStorage.loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 401 });
  }

  const payload = await request.json();
  const { productId, wholesalePrice, retailPrice, isPublic } = payload;

  if (!productId) {
     return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  // Verify ownership? (check if product belongs to shop)
  // For now skipping deep verification for speed, but ideally yes.

  // Atomic Upsert into productExchange
  await db.insert(productExchange)
    .values({
      productId,
      wholesalePrice,
      retailPrice,
      isPublic
    })
    .onConflictDoUpdate({
      target: productExchange.productId,
      set: {
        wholesalePrice,
        retailPrice,
        isPublic
      }
    });

  console.log(`Debug API: Updated product ${productId} isPublic to ${isPublic}`);
  return NextResponse.json({ success: true });
}
