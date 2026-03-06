import { shopify, sessionStorage } from "@/lib/shopify";
import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const productId = params.id;
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });

    if (!sessionId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    try {
        // Get shop record for ownership check and currency info
        const shopRecord = await db.query.shops.findFirst({
            where: eq(shops.shop, session.shop),
        });

        if (!shopRecord) {
            return NextResponse.json({ error: "Shop record not found" }, { status: 404 });
        }

        // Verify product belongs to this shop
        const product = await db.query.products.findFirst({
            where: and(
                eq(products.id, Number(productId)),
                eq(products.shopId, shopRecord.id)
            ),
            with: {
                exchange: true
            }
        });

        if (!product) {
            return NextResponse.json({ error: "Product not found or access denied" }, { status: 404 });
        }

        // Fetch Live Data from Shopify
        let storeDetails = null;
        try {
            const client = new shopify.clients.Rest({ session });
            const response = await client.get({
                path: `products/${product.shopifyProductId}`,
            });
            const shopifyProduct = (response.body as any).product;
            if (shopifyProduct && shopifyProduct.variants?.length > 0) {
                const variant = shopifyProduct.variants[0];
                storeDetails = {
                    price: variant.price,
                    compareAtPrice: variant.compare_at_price,
                    inventoryQuantity: variant.inventory_quantity
                };
            }
        } catch (shopifyError) {
            console.error("[ProductDetail] Failed to fetch live Shopify data:", shopifyError);
        }

        return NextResponse.json({
            product,
            storeDetails,
            shop: {
                currency: shopRecord.currency,
                moneyFormat: shopRecord.moneyFormat
            }
        });
    } catch (error: any) {
        console.error("[ProductDetail] GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    const productId = params.id;
    const sessionId = await shopify.session.getCurrentId({ isOnline: false, rawRequest: request });

    if (!sessionId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await sessionStorage.loadSession(sessionId);
    if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // Get shop for ownership check
    const shopRecord = await db.query.shops.findFirst({
        where: eq(shops.shop, session.shop),
    });
    if (!shopRecord) {
        return NextResponse.json({ error: "Shop not found" }, { status: 404 });
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

    const body = await request.json();
    const { wholesalePrice, retailPrice, isPublic, commissionFlat, commissionPercent } = body;

    try {
        await db.insert(productExchange)
            .values({
                productId: Number(productId),
                wholesalePrice,
                retailPrice,
                isPublic,
                commissionFlat,
                commissionPercent
            })
            .onConflictDoUpdate({
                target: productExchange.productId,
                set: {
                    wholesalePrice,
                    retailPrice,
                    isPublic,
                    commissionFlat,
                    commissionPercent
                }
            });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[ProductDetail] PUT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
