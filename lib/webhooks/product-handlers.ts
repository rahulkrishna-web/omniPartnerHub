import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function handleProductUpdate(shopId: number, product: any) {
  const shopifyProductId = String(product.id);
  const title = product.title;
  const image = product.image?.src || (product.images?.length > 0 ? product.images[0].src : null);
  const vendor = product.vendor;

  // Detect if this product was created via OmniPartner Hub "Add to My Store"
  // Such products are tagged with "omnipartner-hub" in Shopify
  const tags: string = product.tags || "";
  const isHubSourced = tags.toLowerCase().includes("omnipartner-hub");

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
        // Preserve existing isHubSourced — once hub-sourced, always hub-sourced
        // (prevents re-labelling if tags are removed later)
        isHubSourced: existingProduct.isHubSourced || isHubSourced,
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
      isHubSourced,
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
