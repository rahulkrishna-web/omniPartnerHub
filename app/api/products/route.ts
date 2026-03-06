import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");

  let sessionId: string | undefined;
  let shopDomain: string | undefined;

  // Primary: try offline session from cookie/header
  try {
    sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
  } catch (e) {
    // Ignore — will fall through to Bearer token path
  }

  if (sessionId) {
    const session = await sessionStorage.loadSession(sessionId);
    shopDomain = session?.shop;
  }

  // Fallback: decode Bearer JWT to get the shop domain
  if (!shopDomain && authHeader) {
    const token = authHeader.replace("Bearer ", "");
    try {
      const payload = await shopify.session.decodeSessionToken(token);
      shopDomain = (payload as any)?.dest?.replace("https://", "");
    } catch (e) {
      console.error("[Products] Failed to decode Bearer token:", e);
    }
  }

  if (!shopDomain) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get Shop record
  const shopRecord = await db.query.shops.findFirst({
    where: eq(shops.shop, shopDomain),
  });

  if (!shopRecord) {
    return NextResponse.json({ error: "Shop not found in DB" }, { status: 404 });
  }

  // Flat select — avoids Drizzle leftJoin nested object serialization issues
  const rows = await db
    .select({
      id: products.id,
      shopifyProductId: products.shopifyProductId,
      title: products.title,
      image: products.image,
      vendor: products.vendor,
      isHubSourced: products.isHubSourced,
      wholesalePrice: productExchange.wholesalePrice,
      retailPrice: productExchange.retailPrice,
      isPublic: productExchange.isPublic,
    })
    .from(products)
    .leftJoin(productExchange, eq(products.id, productExchange.productId))
    .where(eq(products.shopId, shopRecord.id));

  // Map flat rows → nested exchange object expected by the UI
  const result = rows.map((row) => ({
    id: row.id,
    shopifyProductId: row.shopifyProductId,
    title: row.title,
    image: row.image,
    vendor: row.vendor,
    isHubSourced: row.isHubSourced ?? false,
    exchange: {
      wholesalePrice: row.wholesalePrice,
      retailPrice: row.retailPrice,
      isPublic: row.isPublic ?? false,
    },
  }));

  return NextResponse.json({
    products: result,
    shop: {
      currency: shopRecord.currency,
      moneyFormat: shopRecord.moneyFormat,
    },
  });
}

export async function PUT(request: Request) {
  const authHeader = request.headers.get("Authorization");

  let sessionId: string | undefined;
  let shopDomain: string | undefined;

  try {
    sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
  } catch (e) {
    // ignore
  }

  if (sessionId) {
    const session = await sessionStorage.loadSession(sessionId);
    shopDomain = session?.shop;
  }

  if (!shopDomain && authHeader) {
    const token = authHeader.replace("Bearer ", "");
    try {
      const payload = await shopify.session.decodeSessionToken(token);
      shopDomain = (payload as any)?.dest?.replace("https://", "");
    } catch (e) {
      console.error("[Products PUT] Failed to decode Bearer token:", e);
    }
  }

  if (!shopDomain) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopRecord = await db.query.shops.findFirst({
    where: eq(shops.shop, shopDomain),
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
      isPublic,
    })
    .onConflictDoUpdate({
      target: productExchange.productId,
      set: { wholesalePrice, retailPrice, isPublic },
    });

  return NextResponse.json({ success: true });
}
