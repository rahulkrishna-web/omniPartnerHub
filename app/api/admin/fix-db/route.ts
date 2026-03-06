import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productExchange } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
    try {
        console.log("Starting Radical DB Fix/Cleanup...");

        // 1. Fix column types
        // 2. Remove duplicates
        // 3. Add UNIQUE constraint
        await db.execute(sql`
            -- Fix column types
            ALTER TABLE product_exchange ALTER COLUMN product_id DROP DEFAULT;
            ALTER TABLE product_exchange ALTER COLUMN product_id TYPE integer USING product_id::integer;
            
            -- Deduplicate: Keep only the row with the highest ID (most recent) for each product_id
            DELETE FROM product_exchange a
            USING product_exchange b
            WHERE a.id < b.id
            AND a.product_id = b.product_id;

            -- Add Unique constraint if it doesn't exist
            -- We'll try to drop it first to avoid errors if it exists
            ALTER TABLE product_exchange DROP CONSTRAINT IF EXISTS product_id_unique;
            ALTER TABLE product_exchange ADD CONSTRAINT product_id_unique UNIQUE (product_id);

            -- Fix other tables
            ALTER TABLE partners ALTER COLUMN shop_id DROP DEFAULT;
            ALTER TABLE partners ALTER COLUMN shop_id TYPE integer USING shop_id::integer;
            ALTER TABLE products ALTER COLUMN shop_id DROP DEFAULT;
            ALTER TABLE products ALTER COLUMN shop_id TYPE integer USING shop_id::integer;
        `);

        return NextResponse.json({ success: true, message: "DB Schema fixed, duplicates removed, and uniqueness enforced." });
    } catch (error: any) {
        console.error("Migration Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
