import { db } from "@/lib/db";
import { products, productExchange, shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
// We need client components for interactivity, but we can fetch data here
import { ProductList } from "./product-list";
import { shopify } from "@/lib/shopify";
import { headers } from "next/headers";

// Helper to get current shop from session
async function getCurrentShop() {
  // In a real embedded app, we need to validate the session from the token in headers or query
  // For this MVP, we might rely on the 'shop' query param if we trust it (WE SHOULD NOT TRUST IT IN PROD)
  // Or better, use the session token validation.
  // Given safely validating session in Server Components is tricky without middleware,
  // we will try to extract it.

  // NOTE: For now, we will assume a basic check or pass the params to client to validate.
  // But we need data for the UI.
  // Let's implement a safe way: Retrieve session from storage via a utility if possible.
  // Or cleaner: Client component fetches data via API route which validates session.
  // Server Component approach is better for SEO/Performance but complex validation in App Router.

  // Let's go with Client Component fetching for now to ensure session validity via App Bridge token.
  return null;
}

export default function Home() {
  return (
    <main className="p-4">
       <ProductList />
    </main>
  );
}
