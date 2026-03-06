CREATE TABLE "hub_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_product_id" integer NOT NULL,
	"retailer_shop_id" integer NOT NULL,
	"retailer_shopify_product_id" text,
	"retailer_shopify_variant_id" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_connection_idx" UNIQUE("supplier_product_id","retailer_shop_id")
);
--> statement-breakpoint
CREATE TABLE "hub_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"hub_connection_id" integer NOT NULL,
	"retailer_shop_id" integer NOT NULL,
	"retailer_order_id" text NOT NULL,
	"retailer_order_name" text,
	"retailer_line_item_id" text,
	"supplier_shop_id" integer NOT NULL,
	"supplier_draft_order_id" text,
	"supplier_order_id" text,
	"status" text DEFAULT 'pending',
	"tracking_number" text,
	"tracking_url" text,
	"tracking_company" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_hub_sourced" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "hub_connections" ADD CONSTRAINT "hub_connections_supplier_product_id_products_id_fk" FOREIGN KEY ("supplier_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_connections" ADD CONSTRAINT "hub_connections_retailer_shop_id_shops_id_fk" FOREIGN KEY ("retailer_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_orders" ADD CONSTRAINT "hub_orders_hub_connection_id_hub_connections_id_fk" FOREIGN KEY ("hub_connection_id") REFERENCES "public"."hub_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_orders" ADD CONSTRAINT "hub_orders_retailer_shop_id_shops_id_fk" FOREIGN KEY ("retailer_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_orders" ADD CONSTRAINT "hub_orders_supplier_shop_id_shops_id_fk" FOREIGN KEY ("supplier_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;