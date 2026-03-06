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
  Frame, 
  BlockStack, 
  Spinner, 
  Banner,
  Layout as PolarisLayout
} from "@shopify/polaris";
import { getSessionToken } from "@shopify/app-bridge-utils";

export default function ProductHubPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHubProducts = useCallback(async () => {
    try {
      setLoading(true);
      const token = await window.shopify.idToken();
      
      const response = await fetch("/api/hub/products", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err: any) {
      console.error("Hub fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHubProducts();
  }, [fetchHubProducts]);

  const handleGenerateLink = (productId: number) => {
    console.log("Generate link for product:", productId);
    // Placeholder for Phase 3 affiliate logic
    alert(`Link generation for product ${productId} coming soon in Phase 3!`);
  };

  if (loading) {
    return (
      <>
        <AppNavigation />
        <Page>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
            <Spinner size="large" />
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <AppNavigation />
      <Page title="Product Hub" subtitle="Browse and promote products from our network of suppliers.">
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical">
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}

          {products.length === 0 && !loading && !error ? (
            <Layout.Section>
              <Card>
                <EmptyState
                  heading="No public products available"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Wait for suppliers to mark their products as public to see them here.</p>
                </EmptyState>
              </Card>
            </Layout.Section>
          ) : (
            products.map((product) => (
              <Layout.Section variant="oneThird" key={product.id}>
                <HubProductCard 
                  product={product} 
                  onGenerateLink={handleGenerateLink} 
                />
              </Layout.Section>
            ))
          )}
        </Layout>
      </Page>
    </>
  );
}
