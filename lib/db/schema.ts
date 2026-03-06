import { pgTable, text, serial, timestamp, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  shop: text("shop").notNull().unique(), // e.g. my-store.myshopify.com
  accessToken: text("access_token"), // Offline token
  scope: text("scope"),
  isInstalled: boolean("is_installed").default(false),
  installedAt: timestamp("installed_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shopsRelations = relations(shops, ({ many }) => ({
	products: many(products),
}));

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  shop: text("shop").notNull(),
  state: text("state").notNull(),
  isOnline: boolean("is_online").default(false),
  scope: text("scope"),
  expires: timestamp("expires"),
  accessToken: text("access_token"),
  userId: text("user_id"), // userId can be string in Shopify
});

// Start defining Partner tables for future phases
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id), // Link to the shop if they have one
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  handle: text("handle").unique(), // for boutique URL
  tier: text("tier").default("1"), // 1, 2, 3
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id),
  shopifyProductId: text("shopify_product_id").notNull(),
  title: text("title").notNull(),
  image: text("image"),
  vendor: text("vendor"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productsRelations = relations(products, ({ one }) => ({
	shop: one(shops, { fields: [products.shopId], references: [shops.id] }),
	exchange: one(productExchange, {
		fields: [products.id],
		references: [productExchange.productId],
	}),
}));

export const productExchange = pgTable("product_exchange", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).unique(),
  wholesalePrice: text("wholesale_price"), // stored as string (decimal)
  retailPrice: text("retail_price"),
  isPublic: boolean("is_public").default(false),
  commissionFlat: text("commission_flat"),
  commissionPercent: text("commission_percent"),
}, (table) => {
  return {
    productIdIdx: uniqueIndex("product_id_idx").on(table.productId),
  };
});

export const productExchangeRelations = relations(productExchange, ({ one }) => ({
	product: one(products, { fields: [productExchange.productId], references: [products.id] }),
}));
