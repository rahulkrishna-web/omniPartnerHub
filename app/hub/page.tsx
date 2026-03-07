"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { HubProductCard } from "../components/hub-product-card";
import { triggerAuthRedirect } from "../lib/session";
import {
  Page,
  Layout,
  Card,
  EmptyState,
  Spinner,
  Banner,
  Box,
  InlineStack,
  TextField,
  Select,
  Text,
  Badge,
  BlockStack,
  Divider,
  InlineGrid,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";

export default function ProductHubPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [currentShopId, setCurrentShopId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");

  const [partnerHandle, setPartnerHandle] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const token = await window.shopify.idToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [productsRes, connectionsRes, statsRes] = await Promise.all([
        fetch("/api/hub/products", { headers }),
        fetch("/api/hub/add-to-store", { headers }),
        fetch("/api/dashboard-stats", { headers }),
      ]);

      // 401 = OAuth never completed for this store — trigger the auth flow
      if (productsRes.status === 401) {
        await triggerAuthRedirect();
        return;
      }

      const productsData = await productsRes.json();
      const connectionsData = await connectionsRes.json();
      const statsData = await statsRes.json();

      if (productsData.error) throw new Error(productsData.error);

      setProducts(productsData.products || []);
      setCurrentShopId(productsData.currentShopId ?? null);
      setConnections(connectionsData.connections || []);

      // If this shop is registered as a partner in our partners table, find its handle
      // For MVP, we'll assume the shop might have a partner record
      const partnersRes = await fetch("/api/partners", { headers });
      const partnersData = await partnersRes.json();
      // Look for a partner record that might belong to this shop or just use a placeholder
      // For now, let's just use the shop domain as a fallback handle
      setPartnerHandle(statsData.shop || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddToStore = async (supplierProductId: number) => {
    const token = await window.shopify.idToken();
    const res = await fetch("/api/hub/add-to-store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ supplierProductId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    setSuccessMsg(
      data.alreadyAdded
        ? "Already in your store."
        : "Product added! It's unpublished in Shopify — publish it when ready."
    );

    // Refresh connection status
    const token2 = await window.shopify.idToken();
    const connectionsRes = await fetch("/api/hub/add-to-store", {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const connectionsData = await connectionsRes.json();
    setConnections(connectionsData.connections || []);
  };

  const isProductConnected = (productId: number) =>
    connections.some((c: any) => c.supplierProductId === productId);

  // Unique vendor list for filter dropdown
  const vendorOptions = useMemo(() => {
    const vendors = [...new Set(products.map((p) => p.supplierShop?.replace(".myshopify.com", "") || ""))].filter(Boolean);
    return [
      { label: "All Suppliers", value: "all" },
      ...vendors.map((v) => ({ label: v, value: v })),
    ];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.vendor?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVendor =
        vendorFilter === "all" ||
        p.supplierShop?.replace(".myshopify.com", "") === vendorFilter;
      return matchesSearch && matchesVendor;
    });
  }, [products, searchQuery, vendorFilter]);

  const addedCount = connections.length;
  const ownCount = products.filter((p) => currentShopId !== null && p.supplierShopId === currentShopId).length;
  const availableCount = products.length - ownCount;

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <AdminLayout title="Product Hub">
          <Box padding="1600">
            <InlineStack align="center">
              <BlockStack gap="400" align="center">
                <Spinner size="large" />
                <Text variant="bodyMd" tone="subdued" as="p">Loading products from the hub…</Text>
              </BlockStack>
            </InlineStack>
          </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Product Hub"
      subtitle="Browse and add products from our supplier network to your store."
    >
        <Layout>
          {/* Banners */}
          {error && (
            <Layout.Section>
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}
          {successMsg && (
            <Layout.Section>
              <Banner tone="success" onDismiss={() => setSuccessMsg(null)}>
                <p>{successMsg}</p>
              </Banner>
            </Layout.Section>
          )}

          {products.length === 0 ? (
            <Layout.Section>
              <Card>
                <EmptyState
                  heading="No products in the hub yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Suppliers need to mark their products as Public in My Products before they appear here.</p>
                </EmptyState>
              </Card>
            </Layout.Section>
          ) : (
            <>
              {/* Stats Bar */}
              <Layout.Section>
                <Card>
                  <InlineStack gap="600" blockAlign="center">
                    <BlockStack gap="050">
                      <Text variant="headingLg" as="p">{availableCount}</Text>
                      <Text variant="bodyXs" tone="subdued" as="p">Products Available</Text>
                    </BlockStack>
                    <Divider />
                    <BlockStack gap="050">
                      <Text variant="headingLg" as="p" tone="success">{addedCount}</Text>
                      <Text variant="bodyXs" tone="subdued" as="p">Added to Your Store</Text>
                    </BlockStack>
                    <Divider />
                    <BlockStack gap="050">
                      <Text variant="headingLg" as="p">{vendorOptions.length - 1}</Text>
                      <Text variant="bodyXs" tone="subdued" as="p">Suppliers</Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
              </Layout.Section>

              {/* Search + Filter Bar */}
              <Layout.Section>
                <InlineGrid columns={["twoThirds", "oneThird"]} gap="300">
                  <TextField
                    label="Search"
                    labelHidden
                    placeholder="Search products or brands…"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    prefix={<span>🔍</span>}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setSearchQuery("")}
                  />
                  <Select
                    label="Supplier"
                    labelHidden
                    options={vendorOptions}
                    value={vendorFilter}
                    onChange={setVendorFilter}
                  />
                </InlineGrid>
              </Layout.Section>

              {/* Results count */}
              <Layout.Section>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodyMd" tone="subdued" as="p">
                    {filteredProducts.length === products.length
                      ? `${products.length} products`
                      : `${filteredProducts.length} of ${products.length} products`}
                  </Text>
                  {(searchQuery || vendorFilter !== "all") && (
                    <Badge
                      tone="attention"
                    >
                      Filtered
                    </Badge>
                  )}
                </InlineStack>
              </Layout.Section>

              {/* Product Grid */}
              {filteredProducts.length === 0 ? (
                <Layout.Section>
                  <Card>
                    <Box padding="800">
                      <BlockStack gap="200" align="center">
                        <Text variant="headingMd" as="p">No products match your search</Text>
                        <Text variant="bodyMd" tone="subdued" as="p">Try a different search term or clear the filter.</Text>
                      </BlockStack>
                    </Box>
                  </Card>
                </Layout.Section>
              ) : (
                filteredProducts.map((product) => (
                  <Layout.Section variant="oneThird" key={product.id}>
                    <HubProductCard
                      product={product}
                      isConnected={isProductConnected(product.id)}
                      isOwnProduct={currentShopId !== null && product.supplierShopId === currentShopId}
                      onAddToStore={handleAddToStore}
                      ownShop={currentShopId ? products.find(p => p.supplierShopId === currentShopId)?.supplierShop : undefined}
                      partnerHandle={partnerHandle || undefined}
                    />
                  </Layout.Section>
                ))
              )}
            </>
          )}
        </Layout>
    </AdminLayout>
  );
}
