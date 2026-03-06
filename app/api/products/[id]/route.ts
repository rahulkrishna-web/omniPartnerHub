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
        const product = await db.query.products.findFirst({
            where: eq(products.id, Number(productId)),
            with: {
                exchange: true
            }
        });

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
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
            console.error("Failed to fetch shopify live data:", shopifyError);
            // Non-blocking, return null storeDetails if Shopify fetch fails
        }

        return NextResponse.json({ product, storeDetails });
    } catch (error: any) {
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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
