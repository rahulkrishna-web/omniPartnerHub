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

export async function GET(
  request: Request,
  { params }: { params: { path?: string[] } }
) {
  const url = new URL(request.url);
  
  // Shopify specifically sends the intended path in this header
  const proxyPath = request.headers.get("x-shopify-proxy-path-query") || "";
  console.log(`[Proxy Diagnostic] Full URL: ${request.url}`);
  console.log(`[Proxy Diagnostic] x-shopify-proxy-path-query: ${proxyPath}`);
  console.log(`[Proxy Diagnostic] params.path: ${params.path?.join("/")}`);

  // 1. Verify Signature
  if (!verifyHmac(url)) {
    console.warn("[Proxy Diagnostic] HMAC verification failed");
    return new Response("Unauthorized Signature", { status: 401 });
  }

  // 2. Resolve Partner
  // We'll check the header first, then the params, then the raw URL
  const lookupPath = proxyPath || params.path?.join("/") || url.pathname;
  console.log(`[Proxy Diagnostic] Resolving handle from combined path: ${lookupPath}`);

  // Look for store/[handle] anywhere in the path
  const handleMatch = lookupPath.match(/store\/([^/?]+)/);
  const handle = handleMatch ? handleMatch[1] : null;

  if (!handle) {
    console.error(`[Proxy Diagnostic] 404 - Could not resolve handle from path: ${lookupPath}`);
    return new Response(`Partner Boutique Not Found. (Debug Path: ${lookupPath})`, { status: 404 });
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
        .omni-boutique h2 { margin-bottom: 20px; text-align: center; }
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
          transition: transform 0.2s;
        }
        .omni-card:hover { transform: translateY(-5px); }
        .omni-card img {
          max-width: 100%;
          border-radius: 4px;
          height: 180px;
          object-fit: cover;
        }
        .omni-title {
          font-weight: bold;
          margin: 10px 0;
          display: block;
          min-height: 40px;
        }
        .omni-price {
          color: #2c6ecb;
          font-size: 1.1em;
          margin-bottom: 10px;
        }
        .omni-btn {
          display: block;
          background: #008060;
          color: white !important;
          padding: 10px;
          border-radius: 4px;
          text-decoration: none;
          font-weight: bold;
        }
        .omni-btn:hover { background: #004c3f; }
      </style>

      <div class="omni-boutique">
        <h2>Curated by ${partner.name}</h2>
        <div class="omni-grid">
          ${publicProducts.length === 0 ? '<p>No products in this boutique yet.</p>' : ''}
          ${publicProducts.map((p: any) => `
            <div class="omni-card">
              <img src="${p.image || ''}" alt="${p.title}">
              <span class="omni-title">${p.title}</span>
              <div class="omni-price">$${p.retailPrice || '0.00'}</div>
              <a href="/products/${p.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}" class="omni-btn">View Product</a>
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
    console.error("[Proxy Diagnostic] Runtime Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
