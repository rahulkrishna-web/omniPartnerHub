CREATE TABLE "wallet_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"partner_id" integer,
	"type" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text DEFAULT 'USD',
	"reference_order_id" text,
	"status" text DEFAULT 'pending',
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "hub_orders" ADD COLUMN "supplier_variant_id" text;--> statement-breakpoint
ALTER TABLE "hub_orders" ADD COLUMN "wholesale_price" text;--> statement-breakpoint
ALTER TABLE "hub_orders" ADD COLUMN "retail_price" text;--> statement-breakpoint
ALTER TABLE "hub_orders" ADD COLUMN "commission_amount" text;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;