import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolveSession, ensureShopRecord } from "@/app/lib/shopify-session";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopRecord = await ensureShopRecord(session);
  if (!shopRecord) {
    return NextResponse.json({ error: "Failed to initialise shop record" }, { status: 500 });
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
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopRecord = await ensureShopRecord(session);
  if (!shopRecord) {
    return NextResponse.json({ error: "Failed to initialise shop record" }, { status: 500 });
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

  // Block publishing hub-sourced products to the hub (server-side guard)
  if (isPublic === true && productRecord.isHubSourced) {
    return NextResponse.json({ error: "Dropshipped products cannot be published to the hub" }, { status: 403 });
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
