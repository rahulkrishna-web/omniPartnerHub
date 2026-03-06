import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");

  let sessionId;
  try {
    sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
  } catch (e) {
    console.error("[Products] getCurrentId failed:", e);
  }

  if (!sessionId) {
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        await shopify.session.decodeSessionToken(token);
      } catch (e) {
        console.error("[Products] Failed to decode token:", e);
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

  // Fetch Products with Exchange Data (left join to include products without exchange settings)
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

  return NextResponse.json({
    products: result,
    shop: {
      currency: shopRecord.currency,
      moneyFormat: shopRecord.moneyFormat
    }
  });
}

export async function PUT(request: Request) {
  const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await sessionStorage.loadSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 401 });
  }

  // Get shop to verify ownership
  const shopRecord = await db.query.shops.findFirst({
    where: eq(shops.shop, session.shop),
  });
  if (!shopRecord) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const payload = await request.json();
  const { productId, wholesalePrice, retailPrice, isPublic } = payload;

  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  // Verify the product belongs to this shop
  const productRecord = await db.query.products.findFirst({
    where: and(
      eq(products.id, Number(productId)),
      eq(products.shopId, shopRecord.id)
    ),
  });

  if (!productRecord) {
    return NextResponse.json({ error: "Product not found or access denied" }, { status: 403 });
  }

  // Atomic upsert into productExchange
  await db.insert(productExchange)
    .values({
      productId: Number(productId),
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

  return NextResponse.json({ success: true });
}
