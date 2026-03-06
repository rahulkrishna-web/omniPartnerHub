import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { partners, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

    const shopRecord = await db.query.shops.findFirst({
        where: eq(shops.shop, session.shop)
    });

    if (!shopRecord) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    const allPartners = await db.select().from(partners).where(eq(partners.shopId, shopRecord.id));
    
    return NextResponse.json({ partners: allPartners, shop: session.shop });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

    const shopRecord = await db.query.shops.findFirst({
        where: eq(shops.shop, session.shop)
    });

    if (!shopRecord) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    const { name, email, handle } = await request.json();

    if (!name || !email || !handle) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newPartner = await db.insert(partners).values({
        shopId: shopRecord.id,
        name,
        email,
        handle,
        tier: "1"
    }).returning();

    return NextResponse.json({ partner: newPartner[0] });
  } catch (error: any) {
    if (error.code === '23505') { // Postgres unique violation
        return NextResponse.json({ error: "Handle or email already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
