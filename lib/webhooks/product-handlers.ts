import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function handleProductUpdate(shopId: number, product: any) {
  const shopifyProductId = String(product.id);
  const title = product.title;
  // Handle image safely (can be null, object, or inside images array depending on API version)
  const image = product.image?.src || (product.images?.length > 0 ? product.images[0].src : null);
  const vendor = product.vendor;

  // Check if product exists for this shop
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
  } else {
    await db.insert(products).values({
      shopId,
      shopifyProductId,
      title,
      image,
      vendor,
    });
  }
}

export async function handleProductDelete(shopId: number, payload: any) {
  const shopifyProductId = String(payload.id);

  await db.delete(products).where(
    and(
      eq(products.shopId, shopId),
      eq(products.shopifyProductId, shopifyProductId)
    )
  );
}
