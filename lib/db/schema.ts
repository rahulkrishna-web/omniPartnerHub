import { pgTable, text, serial, timestamp, boolean, integer, uniqueIndex, unique, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  shop: text("shop").notNull().unique(), // e.g. my-store.myshopify.com
  accessToken: text("access_token"), // Offline token
  scope: text("scope"),
  isInstalled: boolean("is_installed").default(false),
  currency: text("currency").default("USD"),
  moneyFormat: text("money_format").default("${{amount}}"),
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id),
  shopifyProductId: text("shopify_product_id").notNull(),
  title: text("title").notNull(),
  image: text("image"),
  vendor: text("vendor"),
  // True when this product was added to this store via the OmniPartner Hub "Add to My Store" flow.
  // Hub-sourced products cannot be re-published to the hub to prevent circular chains.
  isHubSourced: boolean("is_hub_sourced").default(false),
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

// Hub Connections: tracks which retailer is reselling which supplier product
export const hubConnections = pgTable("hub_connections", {
  id: serial("id").primaryKey(),
  supplierProductId: integer("supplier_product_id").references(() => products.id).notNull(),
  retailerShopId: integer("retailer_shop_id").references(() => shops.id).notNull(),
  // Product created in retailer's Shopify store
  retailerShopifyProductId: text("retailer_shopify_product_id"),
  retailerShopifyVariantId: text("retailer_shopify_variant_id"),
  // Maps retailer variant IDs to supplier variant IDs: Record<string, string>
  variantMapping: jsonb("variant_mapping").$type<Record<string, string>>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    uniqueConnection: unique("unique_connection_idx").on(table.supplierProductId, table.retailerShopId),
  };
});

export const hubConnectionsRelations = relations(hubConnections, ({ one, many }) => ({
  supplierProduct: one(products, { fields: [hubConnections.supplierProductId], references: [products.id] }),
  retailerShop: one(shops, { fields: [hubConnections.retailerShopId], references: [shops.id] }),
  orders: many(hubOrders),
}));

// Hub Orders: maps retailer orders to supplier orders (the fulfillment bridge)
export const hubOrders = pgTable("hub_orders", {
  id: serial("id").primaryKey(),
  hubConnectionId: integer("hub_connection_id").references(() => hubConnections.id).notNull(),
  retailerShopId: integer("retailer_shop_id").references(() => shops.id).notNull(),
  retailerOrderId: text("retailer_order_id").notNull(),    // Shopify order ID on retailer side
  retailerOrderName: text("retailer_order_name"),           // e.g. "#1234"
  retailerLineItemId: text("retailer_line_item_id"),
  supplierShopId: integer("supplier_shop_id").references(() => shops.id).notNull(),
  supplierDraftOrderId: text("supplier_draft_order_id"),    // Draft order on supplier side
  supplierOrderId: text("supplier_order_id"),               // Completed order on supplier side
  // Fulfillment tracking (populated when supplier ships)
  status: text("status").default("pending"),                // pending | ordered | fulfilled | cancelled
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  trackingCompany: text("tracking_company"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hubOrdersRelations = relations(hubOrders, ({ one }) => ({
  connection: one(hubConnections, { fields: [hubOrders.hubConnectionId], references: [hubConnections.id] }),
  retailerShop: one(shops, { fields: [hubOrders.retailerShopId], references: [shops.id] }),
  supplierShop: one(shops, { fields: [hubOrders.supplierShopId], references: [shops.id] }),
}));
