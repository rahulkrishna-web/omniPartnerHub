import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

import { shopify, sessionStorage } from "@/lib/shopify";
import { hubConnections, shops } from "@/lib/db/schema";

export async function handleProductUpdate(shopId: number, product: any) {
  const shopifyProductId = String(product.id);
  const title = product.title;
  const image = product.image?.src || (product.images?.length > 0 ? product.images[0].src : null);
  const vendor = product.vendor;

  // Detect if this product was created via OmniPartner Hub "Add to My Store"
  const tags: string = product.tags || "";
  const isHubSourced = tags.toLowerCase().includes("omnipartner-hub");

  const existingProducts = await db.select().from(products).where(
    and(
      eq(products.shopId, shopId),
      eq(products.shopifyProductId, shopifyProductId)
    )
  ).limit(1);

  const existingProduct = existingProducts[0];

  let productIdToSync = existingProduct?.id;

  if (existingProduct) {
    await db
      .update(products)
      .set({
        title,
        image,
        vendor,
        // Preserve existing isHubSourced — once hub-sourced, always hub-sourced
        isHubSourced: existingProduct.isHubSourced || isHubSourced,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existingProduct.id));
  } else {
    const [newProduct] = await db.insert(products).values({
      shopId,
      shopifyProductId,
      title,
      image,
      vendor,
      isHubSourced,
    }).returning();
    productIdToSync = newProduct.id;
  }

  // ==== SYNCHRONIZE CHANGES TO RETAILERS ====
  if (productIdToSync && !isHubSourced) {
    // Only supplier products (not hub-sourced copies) should push updates down
    const connections = await db.query.hubConnections.findMany({
      where: and(
        eq(hubConnections.supplierProductId, productIdToSync),
        eq(hubConnections.isActive, true)
      ),
      with: {
        retailerShop: true,
      }
    });

    if (connections.length > 0) {
      console.log(`[ProductSync] Syncing product updates for supplier product ${productIdToSync} to ${connections.length} retailers.`);
      
      const supplierShop = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
      const shopDomain = supplierShop?.shop?.replace(".myshopify.com", "") || "a partner";
      
      // Do not append appendedBody to body_html as requested by the user
      const bodyHtml = product.body_html;
      const combinedTags = (product.tags ? product.tags + ", " : "") + "omnipartner-hub,dropship";

      // Build array of promises to execute concurrently
      const syncPromises = connections.map(async (connection) => {
        try {
          if (!connection.retailerShop?.shop || !connection.retailerShopifyProductId) return;

          // Load retailer session to interact with their store
          const retailerSessionId = `offline_${connection.retailerShop.shop}`;
          const retailerSession = await sessionStorage.loadSession(retailerSessionId);
          if (!retailerSession) {
            console.warn(`[ProductSync] No offline session found for retailer ${connection.retailerShop.shop}. Skipping sync.`);
            return;
          }

          // Map the updated supplier variants to the retailer variants using the stored mapping
          const mappedVariants = product.variants?.map((supplierVariant: any) => {
            const retailerVariantId = Object.keys(connection.variantMapping || {}).find(
              key => (connection.variantMapping as Record<string, string>)[key] === String(supplierVariant.id)
            );

            return {
              id: retailerVariantId ? Number(retailerVariantId) : undefined,
              price: supplierVariant.price,
              compare_at_price: supplierVariant.compare_at_price,
              option1: supplierVariant.option1,
              option2: supplierVariant.option2,
              option3: supplierVariant.option3,
              weight: supplierVariant.weight,
              weight_unit: supplierVariant.weight_unit,
              inventory_management: supplierVariant.inventory_management || "shopify",
              inventory_policy: supplierVariant.inventory_policy || "deny",
            };
          }) || [];

          const retailerClient = new shopify.clients.Rest({ session: retailerSession });
          await retailerClient.put({
            path: `products/${connection.retailerShopifyProductId}`,
            data: {
              product: {
                id: Number(connection.retailerShopifyProductId),
                title: product.title,
                body_html: bodyHtml,
                vendor: product.vendor || shopDomain,
                tags: combinedTags,
                options: product.options?.map((opt: any) => ({ name: opt.name, values: opt.values })) || [],
                images: product.images?.map((img: any) => ({ src: img.src, alt: img.alt })) || [],
                variants: mappedVariants,
              }
            }
          });
          
          console.log(`[ProductSync] Successfully synced to retailer ${connection.retailerShop.shop}`);
        } catch (err: any) {
          console.error(`[ProductSync] Failed to sync to retailer ${connection.retailerShop?.shop}:`, err?.response?.body?.errors || err.message);
        }
      });

      // Execute all retailer updates concurrently. We await it so the logs show, 
      // but it might delay the webhook 200 OK. For < 50 retailers, it easily finishes in < 2 seconds.
      await Promise.allSettled(syncPromises);
    }
  }
}

export async function handleProductDelete(shopId: number, payload: any) {
  const shopifyProductId = String(payload.id);

  // 1. If the supplier deletes their original product, remove it from the Hub
  await db.delete(products).where(
    and(
      eq(products.shopId, shopId),
      eq(products.shopifyProductId, shopifyProductId)
    )
  );

  // 2. If a retailer deletes a cloned product from their store, mark the connection inactive
  // so they can add it again in the future if they want.
  await db.update(hubConnections)
    .set({ isActive: false })
    .where(
      and(
        eq(hubConnections.retailerShopId, shopId),
        eq(hubConnections.retailerShopifyProductId, shopifyProductId)
      )
    );
}
