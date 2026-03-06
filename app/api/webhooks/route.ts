import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { handleProductUpdate, handleProductDelete } from "@/lib/webhooks/product-handlers";

export async function POST(request: Request) {
  const topic = request.headers.get("X-Shopify-Topic") || "";
  const shop = request.headers.get("X-Shopify-Shop-Domain") || "";

  if (!topic || !shop) {
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const rawBody = await request.text();

  // Verify Shopify HMAC signature to ensure authenticity
  const { valid } = await shopify.webhooks.validate({ rawBody, rawRequest: request });
  if (!valid) {
    console.error(`[Webhooks] Invalid HMAC for topic "${topic}" from shop "${shop}"`);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  try {
    const shopRecords = await db.select().from(shops).where(eq(shops.shop, shop)).limit(1);
    const shopRecord = shopRecords[0];

    if (!shopRecord) {
      console.error(`[Webhooks] Shop not found: ${shop}`);
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    switch (topic) {
      case "products/update":
      case "products/create":
        await handleProductUpdate(shopRecord.id, payload);
        break;
      case "products/delete":
        await handleProductDelete(shopRecord.id, payload);
        break;
      default:
        console.warn(`[Webhooks] Unhandled topic received: ${topic}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhooks] Processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

