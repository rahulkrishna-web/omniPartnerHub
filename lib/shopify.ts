import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";
import { DrizzleSessionStorage } from "./session-storage";

// Ensure process.env is loaded or checked
if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
  throw new Error("Missing Shopify API Credentials");
}

export const sessionStorage = new DrizzleSessionStorage();

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_APP_SCOPES?.split(",") || [],
  hostName: process.env.SHOPIFY_APP_URL ? process.env.SHOPIFY_APP_URL.replace(/https:\/\//, "") : "localhost",
  apiVersion: ApiVersion.April24,
  isEmbeddedApp: true,
  webhooks: {
    path: "/api/webhooks",
  },
});
