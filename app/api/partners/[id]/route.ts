import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { partners, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

    const partnerId = parseInt(params.id);
    if (isNaN(partnerId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const partner = await db.query.partners.findFirst({
        where: eq(partners.id, partnerId)
    });

    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    return NextResponse.json({ partner });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

    const partnerId = parseInt(params.id);
    if (isNaN(partnerId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { name, email, handle, tier } = await request.json();

    const updated = await db.update(partners)
        .set({ name, email, handle, tier })
        .where(eq(partners.id, partnerId))
        .returning();

    return NextResponse.json({ partner: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

    const partnerId = parseInt(params.id);
    if (isNaN(partnerId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await db.delete(partners).where(eq(partners.id, partnerId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
