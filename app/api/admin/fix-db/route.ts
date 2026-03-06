import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productExchange } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
    try {
        console.log("Starting Radical DB Fix/Cleanup...");

        // 1. Fix product_exchange.product_id (crucial for current bug)
        // 2. Fix partners.shop_id and products.shop_id (prevent future bugs)
        // 3. Truncate exchange as its data is corrupt
        await db.execute(sql`
            -- Fix product_exchange
            ALTER TABLE product_exchange ALTER COLUMN product_id DROP DEFAULT;
            ALTER TABLE product_exchange ALTER COLUMN product_id TYPE integer USING product_id::integer;
            
            -- Fix partners
            ALTER TABLE partners ALTER COLUMN shop_id DROP DEFAULT;
            ALTER TABLE partners ALTER COLUMN shop_id TYPE integer USING shop_id::integer;

            -- Fix products
            ALTER TABLE products ALTER COLUMN shop_id DROP DEFAULT;
            ALTER TABLE products ALTER COLUMN shop_id TYPE integer USING shop_id::integer;

            TRUNCATE TABLE product_exchange;
        `);

        return NextResponse.json({ success: true, message: "DB Schema fixed and corrupted exchange data cleared. Please re-mark products as public." });
    } catch (error: any) {
        console.error("Migration Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
