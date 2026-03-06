import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productExchange, partners } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function verifyHmac(url: URL) {
  const hmac = url.searchParams.get("hmac");
  if (!hmac) return false;

  const params = Array.from(url.searchParams.entries())
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  const calculatedHmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(params)
    .digest("hex");

  return calculatedHmac === hmac;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  console.log(`Debug Proxy: Request received for ${url.pathname}${url.search}`);

  // 1. Verify Signature
  if (!verifyHmac(url)) {
    console.warn("Debug Proxy: HMAC verification failed");
    console.warn("[Proxy Diagnostic] HMAC verification failed");
    return new Response("Unauthorized Signature", { status: 401 });
  }

  // 2. Resolve Partner
  const path = url.pathname;
  
  // Try regex match for /store/handle
  let handleMatch = path.match(/\/store\/([^/]+)/);
  
  // Fallback: If Shopify strips parts of the path, try to find the handle at the end
  if (!handleMatch) {
    const segments = path.split("/").filter(Boolean);
    // If we have a path like /api/proxy/rahul
    if (segments.length >= 3 && segments[segments.length - 2] === "store") {
       handleMatch = [null, segments[segments.length - 1]] as any;
    }
  }

  const handle = handleMatch ? handleMatch[1] : null;

  if (!handle) {
    console.error(`[Proxy Diagnostic] 404 - Could not resolve handle from path: ${path}`);
    return new Response(`Partner Handle Not Found (Path: ${path})`, { status: 404 });
  }

  console.log(`[Proxy Diagnostic] Success - Resolved handle: ${handle}`);

  try {
    // 3. Find Partner & Shop
    const partner = await db.query.partners.findFirst({
        where: eq(partners.handle, handle)
    });

    if (!partner || !partner.shopId) {
        return new Response("Boutique Not Found or Inactive", { status: 404 });
    }

    // 4. Fetch Public Products for this shop
    const publicProducts = await db
        .select({
            id: products.id,
            title: products.title,
            image: products.image,
            vendor: products.vendor,
            retailPrice: productExchange.retailPrice,
            commissionPercent: productExchange.commissionPercent
        })
        .from(products)
        .innerJoin(productExchange, eq(products.id, productExchange.productId))
        .where(
            and(
                eq(products.shopId, partner.shopId as number),
                eq(productExchange.isPublic, true)
            )
        );

    // 5. Render Liquid-compatible HTML
    const html = `
      <style>
        .omni-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
          padding: 20px 0;
        }
        .omni-card {
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          background: #fff;
        }
        .omni-card img {
          max-width: 100%;
          border-radius: 4px;
          height: 150px;
          object-fit: cover;
        }
        .omni-title {
          font-weight: bold;
          margin: 10px 0;
          display: block;
        }
        .omni-price {
          color: #2c6ecb;
          font-size: 1.1em;
        }
        .omni-btn {
          display: block;
          background: #008060;
          color: white;
          padding: 8px;
          border-radius: 4px;
          text-decoration: none;
          margin-top: 10px;
        }
      </style>

      <div class="omni-boutique">
        <h2>${partner.name}'s Collection</h2>
        <div class="omni-grid">
          ${publicProducts.map(p => `
            <div class="omni-card">
              <img src="${p.image || ''}" alt="${p.title}">
              <span class="omni-title">${p.title}</span>
              <div class="omni-price">$${p.retailPrice || '0.00'}</div>
              <a href="/products/${p.title.toLowerCase().replace(/\s+/g, '-')}" class="omni-btn">View Details</a>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    return new Response(html, {
      headers: {
        "Content-Type": "application/liquid",
      },
    });
  } catch (error: any) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
