"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Spinner,
  Box,
  Thumbnail,
  Divider,
  Checkbox
} from "@shopify/polaris";
import { AppNavigation } from "../../components/app-navigation";

// Helper to get session token safely
async function getSessionToken() {
  if (typeof window === "undefined") return null;
  if (window.shopify && window.shopify.idToken) {
    return await window.shopify.idToken();
  }
  return null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [commissionFlat, setCommissionFlat] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/products/${id}`, { headers });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      const p = data.product;
      setProduct(p);
      setRetailPrice(p.exchange?.retailPrice || "0.00");
      setWholesalePrice(p.exchange?.wholesalePrice || "0.00");
      setCommissionPercent(p.exchange?.commissionPercent || "0");
      setCommissionFlat(p.exchange?.commissionFlat || "0.00");
      setIsPublic(!!p.exchange?.isPublic);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const token = await getSessionToken();
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          retailPrice,
          wholesalePrice,
          commissionPercent,
          commissionFlat,
          isPublic
        })
      });

      if (!res.ok) throw new Error("Failed to save changes");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box padding="800">
        <InlineStack align="center">
          <Spinner size="large" />
        </InlineStack>
      </Box>
    );
  }

  if (!product && !loading) {
    return (
      <Page backAction={{ content: "Products", onAction: () => router.push("/products") }}>
         <Banner tone="critical">Product not found</Banner>
      </Page>
    );
  }

  return (
    <>
      <AppNavigation />
      <Page
        backAction={{ content: "Products", onAction: () => router.push("/products") }}
        title={product.title}
        subtitle={product.vendor}
        compactTitle
        primaryAction={{
          content: "Save",
          onAction: handleSave,
          loading: saving
        }}
      >
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical">{error}</Banner>
            </Layout.Section>
          )}
          {success && (
            <Layout.Section>
              <Banner tone="success">Changes saved successfully</Banner>
            </Layout.Section>
          )}

          <Layout.Section variant="oneThird">
             <Card>
                <BlockStack gap="400">
                    <Thumbnail source={product.image || ""} alt={product.title} size="large" />
                    <BlockStack gap="200">
                        <Text variant="headingMd" as="h2">Product Info</Text>
                        <Text variant="bodyMd" as="p">Shopify ID: {product.shopifyProductId}</Text>
                        <Badge tone={isPublic ? "success" : "attention"}>
                            {isPublic ? "Public in Boutique" : "Private"}
                        </Badge>
                    </BlockStack>
                </BlockStack>
             </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Exchange Settings</Text>
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="Retail Price"
                      value={retailPrice}
                      onChange={setRetailPrice}
                      prefix="$"
                      autoComplete="off"
                      helpText="The price shown to customers in the boutique."
                    />
                    <TextField
                      label="Wholesale Price"
                      value={wholesalePrice}
                      onChange={setWholesalePrice}
                      prefix="$"
                      autoComplete="off"
                      helpText="The price you receive from the retailer/partner."
                    />
                  </FormLayout.Group>

                  <Divider />
                  
                  <Text variant="headingSm" as="h3">Commission Structure</Text>
                  <FormLayout.Group>
                    <TextField
                      label="Commission Percent"
                      value={commissionPercent}
                      onChange={setCommissionPercent}
                      suffix="%"
                      type="number"
                      autoComplete="off"
                      helpText="Percent paid to the partner on each sale."
                    />
                    <TextField
                      label="Flat Commission"
                      value={commissionFlat}
                      onChange={setCommissionFlat}
                      prefix="$"
                      autoComplete="off"
                      helpText="Fixed amount paid to the partner per sale."
                    />
                  </FormLayout.Group>

                  <Divider />

                  <Checkbox
                    label="Visible in Boutique Storefront"
                    checked={isPublic}
                    onChange={setIsPublic}
                    helpText="If checked, this product will appear in all partner boutiques."
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </>
  );
}
