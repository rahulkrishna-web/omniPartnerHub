"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  Badge,
  Button,
  TextField,
  BlockStack,
  InlineStack,
  Banner,
  ButtonGroup,
  EmptyState
} from "@shopify/polaris";
// ... existing imports

// Helper to get session token safely
async function getSessionToken() {
    if (typeof window === "undefined") return null;

    // WaitFor shopify global
    if (!window.shopify) {
        console.log("Debug: window.shopify not defined yet, waiting...");
        await new Promise((resolve) => {
            const interval = setInterval(() => {
                if (window.shopify) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
            setTimeout(() => {
                clearInterval(interval);
                resolve(false);
            }, 2000);
        });
    }

    if (window.shopify) {
        try {
            // App Bridge v4 (CDN) uses idToken()
            if (window.shopify.idToken) {
                const token = await window.shopify.idToken();
                 console.log("Debug: idToken() success", token ? "Yes" : "No");
                 return token;
            }
            // Fallback for older versions
            if (window.shopify.id && window.shopify.id.getSessionToken) {
                const token = await window.shopify.id.getSessionToken();
                console.log("Debug: getSessionToken success", token ? "Yes" : "No");
                return token;
            }
        } catch (e) {
            console.error("Debug: Failed to get session token:", e);
            return null;
        }
    } else {
        console.error("Debug: window.shopify still missing after wait");
    }
    return null;
}

export function ProductList() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const shopParam = url.searchParams.get("shop");
        if (shopParam) setShop(shopParam);
    }
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const token = await getSessionToken();
      console.log("Debug: Session Token for fetchProducts:", token ? "Present" : "Missing");
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/products", { headers });
      
      if (!res.ok) {
        if (res.status === 401) {
            throw new Error("Unauthorized");
        }
        throw new Error(`API Error: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      } else if (data.error) {
         setError(data.error);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "Unauthorized") {
          setError("Unauthorized");
      } else {
          setError(err.message || "Failed to load products");
      }
    }
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
        const token = await getSessionToken();
        console.log("Debug: Session Token for handleSync:", token ? "Present" : "Missing");

        const headers: any = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch("/api/products/sync", { method: "POST", headers });
        if (!res.ok) {
             throw new Error("Sync failed. Check console.");
        }
        await fetchProducts();
    } catch (err: any) {
        setError(err.message);
    }
    setSyncing(false);
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const emptyStateMarkup = (
    <EmptyState
      heading="No products found"
      action={{
        content: 'Sync products',
        onAction: handleSync,
        loading: syncing
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Sync your products from Shopify to allow Partners to see them.</p>
    </EmptyState>
  );

  return (
    <Page
      title="Unified Product Panel"
      primaryAction={{
        content: syncing ? "Syncing..." : "Sync from Shopify",
        onAction: handleSync,
        disabled: syncing,
      }}
    >
      <Layout>
        <Layout.Section>
          {error && (
            <Banner 
                tone="critical" 
                onDismiss={() => setError(null)}
                title={error === "Unauthorized" ? "Authentication Failed" : "Error"}
            >
              <p>
                {error === "Unauthorized" 
                    ? "The app could not authenticate with Shopify. This usually happens if cookies are blocked or the session expired." 
                    : error}
              </p>
              {error === "Unauthorized" && shop && (
                  <div style={{marginTop: 10}}>
                    <Button onClick={() => {
                        window.open(`/api/auth?shop=${shop}`, '_top');
                    }}>
                        Re-authenticate
                    </Button>
                  </div>
              )}
            </Banner>
          )}
          <Card>
            <ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              items={products}
              emptyState={emptyStateMarkup}
              renderItem={(item) => {
                const { id, title, image, vendor, exchange } = item;
                const media = (
                  <Thumbnail
                    source={image || ""}
                    alt={title}
                  />
                );

                return (
                  <ResourceItem
                    id={id}
                    url="#"
                    media={media}
                    accessibilityLabel={`View details for ${title}`}
                  >
                    <BlockStack gap="200">
                        <InlineStack align="space-between">
                            <Text variant="bodyMd" fontWeight="bold" as="h3">
                                {title}
                            </Text>
                            <Badge tone={exchange?.isPublic ? "success" : "attention"}>
                                {exchange?.isPublic ? "Public" : "Private"}
                            </Badge>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                            {vendor}
                        </Text>
                       {/* We can add inline edit fields here later */}
                    </BlockStack>
                  </ResourceItem>
                );
              }}
              loading={loading}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
