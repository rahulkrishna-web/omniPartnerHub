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
import { useAppBridge } from "@shopify/app-bridge-react";

// ... existing imports

export function ProductList() {
  const app = useAppBridge();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editedIsPublic, setEditedIsPublic] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products");
      
      if (!res.ok) {
        if (res.status === 401) {
            throw new Error("Unauthorized. Try reloading the app.");
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
      setError(err.message || "Failed to load products");
    }
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
        const res = await fetch("/api/products/sync", { method: "POST" });
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
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
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
