import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productExchange } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
    try {
        console.log("Starting Radical DB Fix/Cleanup...");

        // 1. Correct Column Type
        // 2. Remove Duplicates
        // 3. Create the UNIQUE INDEX Drizzle expects
        await db.execute(sql`
            -- 1. Correct Column Type
            ALTER TABLE product_exchange ALTER COLUMN product_id DROP DEFAULT;
            ALTER TABLE product_exchange ALTER COLUMN product_id TYPE integer USING product_id::integer;
            
            -- 2. Deduplicate
            DELETE FROM product_exchange a
            USING product_exchange b
            WHERE a.id < b.id
            AND a.product_id = b.product_id;

            -- 3. Create Unique Index (matches drizzle schema)
            DROP INDEX IF EXISTS product_id_idx;
            CREATE UNIQUE INDEX product_id_idx ON product_exchange (product_id);

            -- 4. Fix other shop_id columns
            ALTER TABLE partners ALTER COLUMN shop_id DROP DEFAULT;
            ALTER TABLE partners ALTER COLUMN shop_id TYPE integer USING shop_id::integer;
            ALTER TABLE products ALTER COLUMN shop_id DROP DEFAULT;
            ALTER TABLE products ALTER COLUMN shop_id TYPE integer USING shop_id::integer;
        `);

        console.log("DB Repair: Success");
        return NextResponse.json({ success: true, message: "DB Radical Fix Complete. Unique index created. Persistence should now work perfectly." });
    } catch (error: any) {
        console.error("DB Repair Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
