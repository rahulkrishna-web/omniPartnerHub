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
  BlockStack, // Use BlockStack instead of Stack (deprecated) or LegacyStack
  InlineStack,
  Banner
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { getSessionToken } from "@shopify/app-bridge-utils"; // Check if this package is needed or if app-bridge-react exports it
// Actually getSessionToken is in @shopify/app-bridge-utils usually, but let's check imports.
// Modern App Bridge might use `useAppBridge` hook to get the app instance, then `getSessionToken(app)`.

export function ProductList() {
  const app = useAppBridge();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function fetchProducts() {
    setLoading(true);
    try {
      // Use standard fetch. The App Bridge middleware (if used) handles headers, or we pass token manually.
      // Since we don't have the token middleware set up in Next.js config yet, we need to rely on the session cookie if strictly online
      // OR we fetch token and pass it.
      // For this MVP step 1: Let's try simple fetch, assuming session cookie is set from OAuth flow (isOnline: true in our OAuth).
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/products/sync", { method: "POST" });
    await fetchProducts();
    setSyncing(false);
  }

  useEffect(() => {
    fetchProducts();
  }, []);

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
          <Card>
            <ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              items={products}
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
