import { db } from "./lib/db";
import { sql } from "drizzle-orm";

async function checkSchema() {
  try {
    console.log("Checking schema for product_exchange table...");
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'product_exchange';
    `);
    console.log("Schema Result:", JSON.stringify(result.rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Schema Check Error:", error);
    process.exit(1);
  }
}

checkSchema();
