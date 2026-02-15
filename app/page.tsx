import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
// We need client components for interactivity, but we can fetch data here
import { ProductList } from "./product-list";
import { shopify } from "@/lib/shopify";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Helper to get current shop from session
async function getCurrentShop() {
  return null;
}

export default function Home() {
  return (
    <main className="p-4">
       <ProductList />
    </main>
  );
}
