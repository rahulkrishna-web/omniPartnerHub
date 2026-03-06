"use client";

import { useEffect, useState, useCallback } from "react";
import { AppNavigation } from "../components/app-navigation";
import { HubProductCard } from "../components/hub-product-card";
import {
  Page,
  Layout,
  Card,
  Text,
  EmptyState,
  Spinner,
  Banner,
  Box,
  InlineStack,
} from "@shopify/polaris";

export default function ProductHubPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const token = await window.shopify.idToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [productsRes, connectionsRes] = await Promise.all([
        fetch("/api/hub/products", { headers }),
        fetch("/api/hub/add-to-store", { headers }),
      ]);

      const productsData = await productsRes.json();
      const connectionsData = await connectionsRes.json();

      if (productsData.error) throw new Error(productsData.error);

      setProducts(productsData.products || []);
      setConnections(connectionsData.connections || []);
    } catch (err: any) {
      console.error("Hub fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddToStore = async (supplierProductId: number) => {
    try {
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
          ? "Product already in your store."
          : "Product added to your store! Publish it from Shopify Admin when ready."
      );

      // Refresh connections to update badge state
      const token2 = await window.shopify.idToken();
      const connectionsRes = await fetch("/api/hub/add-to-store", {
        headers: { Authorization: `Bearer ${token2}` },
      });
      const connectionsData = await connectionsRes.json();
      setConnections(connectionsData.connections || []);
    } catch (err: any) {
      setError(err.message);
      throw err; // Re-throw so the card button loading state resets
    }
  };

  const isProductConnected = (productId: number) =>
    connections.some((c: any) => c.supplierProductId === productId);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <>
        <AppNavigation />
        <Page>
          <Box padding="800">
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          </Box>
        </Page>
      </>
    );
  }

  return (
    <>
      <AppNavigation />
      <Page
        title="Product Hub"
        subtitle="Add products from our supplier network directly to your store."
        secondaryActions={[{ content: "My Hub Orders", url: "/hub/orders" }]}
      >
        <Layout>
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
                  heading="No public products available"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Suppliers need to mark their products as public for them to appear here.</p>
                </EmptyState>
              </Card>
            </Layout.Section>
          ) : (
            products.map((product) => (
              <Layout.Section variant="oneThird" key={product.id}>
                <HubProductCard
                  product={product}
                  isConnected={isProductConnected(product.id)}
                  onAddToStore={handleAddToStore}
                  onGenerateLink={(id) => {
                    // Placeholder for affiliate link logic
                    alert(`Affiliate link for product ${id} coming soon!`);
                  }}
                />
              </Layout.Section>
            ))
          )}
        </Layout>
      </Page>
    </>
  );
}
