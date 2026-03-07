import { NextResponse } from "next/server";
import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 401 });

    const { role } = await request.json();
    if (!role || !["supplier", "partner"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    await db.update(shops)
      .set({ role, updatedAt: new Date() })
      .where(eq(shops.shop, session.shop));

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    console.error("[SettingsAPI] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
