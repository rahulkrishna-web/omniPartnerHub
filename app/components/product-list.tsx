"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Thumbnail,
  FormLayout,
  TextField,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  EmptyState,
  Spinner,
  Box,
  Link,
} from "@shopify/polaris";

// Helper to get session token safely
async function getSessionToken() {
  if (typeof window === "undefined") return null;

  if (!window.shopify) {
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
      if (window.shopify.idToken) {
        return await window.shopify.idToken();
      }
    } catch (e) {
      console.error("Failed to get session token:", e);
    }
  }
  return null;
}

export function ProductList() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<string>("");

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const shopParam = url.searchParams.get("shop");
      if (shopParam) setShop(shopParam);
    }
  }, []);

  async function fetchProducts(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/products", { headers });
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err: any) {
      if (!silent) setError(err.message || "Failed to load products");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleBulkUpdate(isPublic: boolean) {
    // Optimistic Update
    const previousProducts = [...products];
    const updatedProducts = products.map((p) => {
      if (selectedResources.includes(p.id)) {
        return { ...p, exchange: { ...p.exchange, isPublic } };
      }
      return p;
    });
    setProducts(updatedProducts);

    try {
      const token = await getSessionToken();
      const res = await fetch("/api/products/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productIds: selectedResources, isPublic }),
      });
      if (!res.ok) throw new Error("Bulk update failed");
      await fetchProducts(true); // Silent refresh to sync with DB
    } catch (err: any) {
      setError(err.message);
      setProducts(previousProducts); // Rollback
    }
  }

  async function toggleVisibility(productId: number, currentStatus: boolean) {
    // Optimistic Update
    const previousProducts = [...products];
    const updatedProducts = products.map((p) => {
      if (p.id === productId) {
        return { ...p, exchange: { ...p.exchange, isPublic: !currentStatus } };
      }
      return p;
    });
    setProducts(updatedProducts);
    setUpdatingIds((prev) => [...prev, productId]);

    try {
      const token = await getSessionToken();
      const res = await fetch("/api/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, isPublic: !currentStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchProducts(true); // Silent refresh
    } catch (err: any) {
      setError(err.message);
      setProducts(previousProducts); // Rollback
    } finally {
      setUpdatingIds((prev) => prev.filter((id) => id !== productId));
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch("/api/products/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Sync failed");
      await fetchProducts();
    } catch (err: any) {
      setError(err.message);
    }
    setSyncing(false);
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const bulkActions = [
    {
      content: "Mark as Public",
      onAction: () => handleBulkUpdate(true),
    },
    {
      content: "Mark as Private",
      onAction: () => handleBulkUpdate(false),
    },
  ];

  async function updatePrice(productId: number, field: 'retailPrice' | 'wholesalePrice', value: string) {
    const previousProducts = [...products];
    const updatedProducts = products.map((p) => {
      if (p.id === productId) {
        return { ...p, exchange: { ...p.exchange, [field]: value } };
      }
      return p;
    });
    setProducts(updatedProducts);

    try {
      const token = await getSessionToken();
      const product = updatedProducts.find(p => p.id === productId);
      const res = await fetch("/api/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
            productId, 
            retailPrice: product?.exchange.retailPrice,
            wholesalePrice: product?.exchange.wholesalePrice,
            isPublic: product?.exchange.isPublic 
        }),
      });
      if (!res.ok) throw new Error("Price update failed");
    } catch (err: any) {
      setError(err.message);
      setProducts(previousProducts);
    }
  }

  const rowMarkup = products.map(
    ({ id, title, image, vendor, exchange }, index) => {
      const isUpdating = updatingIds.includes(id);
      return (
        <IndexTable.Row
          id={id}
          key={id}
          selected={selectedResources.includes(id)}
          position={index}
        >
          <IndexTable.Cell>
            <Thumbnail source={image || ""} alt={title} size="small" />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <div onClick={(e) => e.stopPropagation()}>
              <Link
                url={`/products/${id}`}
                dataPrimaryLink
              >
                <Text variant="bodyMd" fontWeight="bold" as="span">
                  {title}
                </Text>
              </Link>
            </div>
          </IndexTable.Cell>
          <IndexTable.Cell>{vendor}</IndexTable.Cell>
          <IndexTable.Cell>
            <TextField
              label="Wholesale"
              labelHidden
              value={exchange?.wholesalePrice || "0.00"}
              onChange={(val: string) => updatePrice(id, 'wholesalePrice', val)}
              prefix="$"
              autoComplete="off"
            />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <TextField
              label="Retail"
              labelHidden
              value={exchange?.retailPrice || "0.00"}
              onChange={(val: string) => updatePrice(id, 'retailPrice', val)}
              prefix="$"
              autoComplete="off"
            />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={exchange?.isPublic ? "success" : "attention"}>
              {exchange?.isPublic ? "Public" : "Private"}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Button
              size="slim"
              loading={isUpdating}
              onClick={() => toggleVisibility(id, exchange?.isPublic)}
            >
              {exchange?.isPublic ? "Make Private" : "Make Public"}
            </Button>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
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
          <Card padding="0">
            {loading ? (
              <Box padding="400">
                <InlineStack align="center">
                  <Spinner size="large" />
                </InlineStack>
              </Box>
            ) : products.length === 0 ? (
              <EmptyState
                heading="No products found"
                action={{
                  content: "Sync products",
                  onAction: handleSync,
                  loading: syncing,
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Sync your products from Shopify to start managing them.</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={products.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                bulkActions={bulkActions}
                headings={[
                  { title: "" },
                  { title: "Product" },
                  { title: "Vendor" },
                  { title: "Wholesale" },
                  { title: "Retail Price" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
