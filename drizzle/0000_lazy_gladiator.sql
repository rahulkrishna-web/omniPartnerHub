CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"handle" text,
	"tier" text DEFAULT '1',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "partners_email_unique" UNIQUE("email"),
	CONSTRAINT "partners_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "product_exchange" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"wholesale_price" text,
	"retail_price" text,
	"is_public" boolean DEFAULT false,
	"commission_flat" text,
	"commission_percent" text,
	CONSTRAINT "product_exchange_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer,
	"shopify_product_id" text NOT NULL,
	"title" text NOT NULL,
	"image" text,
	"vendor" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"is_online" boolean DEFAULT false,
	"scope" text,
	"expires" timestamp,
	"access_token" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"access_token" text,
	"scope" text,
	"is_installed" boolean DEFAULT false,
	"currency" text DEFAULT 'USD',
	"money_format" text DEFAULT '${{amount}}',
	"installed_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shops_shop_unique" UNIQUE("shop")
);
--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_exchange" ADD CONSTRAINT "product_exchange_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_id_idx" ON "product_exchange" USING btree ("product_id");