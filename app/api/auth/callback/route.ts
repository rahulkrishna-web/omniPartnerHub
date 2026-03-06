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

    // Store session FIRST — this must succeed before anything else
    if (shopify.config.sessionStorage) {
      await shopify.config.sessionStorage.storeSession(session);
    }

    // ─── SHOP UPSERT — must happen before any other DB operations ───────────
    // Wrapped independently so webhook registration failures cannot prevent
    // the shop from being created in our database.
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

    // ─── CURRENCY FETCH — non-critical, log and continue on failure ──────────
    try {
      const client = new shopify.clients.Rest({ session });
      const shopResponse = await client.get({ path: "shop" });
      const shopInfo = (shopResponse.body as any).shop;
      if (shopInfo) {
        await db
          .update(shops)
          .set({
            currency: shopInfo.currency,
            moneyFormat: shopInfo.money_format,
          })
          .where(eq(shops.shop, session.shop));
      }
    } catch (e) {
      console.error("[Auth] Failed to fetch shop currency at install:", e);
    }

    // ─── WEBHOOK REGISTRATION — non-critical, log and continue on failure ────
    // We define webhooks via shopify.app.toml, but programmatic registration
    // is kept as a fallback. It must NOT block the install on failure.
    try {
      await shopify.webhooks.register({ session });
    } catch (e) {
      console.error("[Auth] Webhook registration failed (non-fatal):", e);
    }

    // Redirect to embedded app
    const apiKey = process.env.SHOPIFY_API_KEY;
    const shopName = session.shop.replace(".myshopify.com", "");
    const adminUrl = `https://admin.shopify.com/store/${shopName}/apps/${apiKey}`;

    return NextResponse.redirect(adminUrl);
  } catch (error) {
    console.error("[Auth] Callback error:", error);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
