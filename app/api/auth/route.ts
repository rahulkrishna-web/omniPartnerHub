import { shopify } from "@/lib/shopify";
import { NextResponse } from "next/server";

// ... imports

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    const sanitizedShop = shopify.utils.sanitizeShop(shop);
    if (!sanitizedShop) {
      return NextResponse.json({ error: "Invalid shop parameter" }, { status: 400 });
    }

    const response = await shopify.auth.begin({
      shop: sanitizedShop,
      callbackPath: "/api/auth/callback",
      isOnline: false,
      rawRequest: request,
    });

    return response; 

  } catch (error: any) {
    console.error("Error in /api/auth:", error);
    return NextResponse.json({ 
        error: "Internal Server Error", 
        details: error.message,
        stack: error.stack 
    }, { status: 500 });
  }
}
