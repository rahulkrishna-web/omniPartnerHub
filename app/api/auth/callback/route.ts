import { shopify } from "@/lib/shopify";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: request,
    });

    const { session } = callbackResponse;

    // Verify session storage
    if (shopify.config.sessionStorage) {
        console.log("Debug Callback: Explicitly storing session...", session.id);
        const stored = await shopify.config.sessionStorage.storeSession(session);
        if (!stored) {
             console.error("Debug Callback: Failed to store session explicitely.");
        } else {
             console.log("Debug Callback: Session stored successfully.");
        }
    } else {
        console.error("Debug Callback: No sessionStorage configured on shopify client!");
    }
    
    // Register Webhooks
    const webhookResponse = await shopify.webhooks.register({
      session,
    });

    if (!webhookResponse["PRODUCTS_UPDATE"]?.[0]?.success) {
      console.error("Failed to register PRODUCTS_UPDATE webhook", webhookResponse);
    } else {
        console.log("Registered PRODUCTS_UPDATE webhook");
    }

     // Update shop record (Session storage handles the token, but we track installation status here)
    await db
      .insert(shops)
      .values({
        shop: session.shop,
        accessToken: session.accessToken,
        isInstalled: true,
        scope: session.scope,
      })
      .onConflictDoUpdate({
        target: shops.shop,
        set: {
          accessToken: session.accessToken,
          isInstalled: true,
          scope: session.scope,
          updatedAt: new Date(),
        },
      });

    // Redirect to Shopify Admin
    // Construct the embedded app URL
    const apiKey = process.env.SHOPIFY_API_KEY;
    const shopName = session.shop.replace(".myshopify.com", "");
    const adminUrl = `https://admin.shopify.com/store/${shopName}/apps/${apiKey}`;

    return NextResponse.redirect(adminUrl);
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
