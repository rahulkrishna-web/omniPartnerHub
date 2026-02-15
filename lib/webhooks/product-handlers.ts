import { db } from "@/lib/db";
import { products, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function handleProductUpdate(shopId: number, product: any) {
  const shopifyProductId = String(product.id);
  const title = product.title;
  // Handle image safely (it can be null or array or object depending on API version, usually object with src)
  // For 'products/update' payload, image is often a single object or part of images array.
  // We'll try to get the first image src.
  const image = product.image?.src || (product.images && product.images.length > 0 ? product.images[0].src : null);
  const vendor = product.vendor;

  console.log(`Processing product update: ${shopifyProductId} for shop ${shopId}`);

  // Check if product exists
  // We need to query by shopId AND shopifyProductId to be safe
  const existingProducts = await db.select().from(products).where(
    and(
      eq(products.shopId, shopId),
      eq(products.shopifyProductId, shopifyProductId)
    )
  ).limit(1);

  const existingProduct = existingProducts[0];

  if (existingProduct) {
    await db
      .update(products)
      .set({
        title,
        image,
        vendor,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existingProduct.id));
    console.log(`Updated product ${existingProduct.id}`);
  } else {
    await db.insert(products).values({
      shopId,
      shopifyProductId,
      title,
      image,
      vendor,
    });
    console.log(`Created new product for shop ${shopId}`);
  }
}

export async function handleProductDelete(shopId: number, payload: any) {
  const shopifyProductId = String(payload.id);

  // Use delete with multiple conditions
  await db.delete(products).where(
    and(
      eq(products.shopId, shopId),
      eq(products.shopifyProductId, shopifyProductId)
    )
  );
  console.log(`Deleted product ${shopifyProductId} for shop ${shopId}`);
}
