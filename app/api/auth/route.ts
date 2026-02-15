import { shopify } from "@/lib/shopify";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ... imports

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    let shopToSanitize = shop;
    if (!shopToSanitize.includes(".")) {
        shopToSanitize += ".myshopify.com";
    }
    // Simple sanitization fallback if utils fail or purely rely on shopify-api
    const sanitizedShop = shopify.utils.sanitizeShop(shopToSanitize);

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
