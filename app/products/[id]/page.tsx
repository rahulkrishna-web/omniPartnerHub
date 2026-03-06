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

import { getSessionToken } from "../../lib/session";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [product, setProduct] = useState<any>(null);
  const [storeDetails, setStoreDetails] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
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

  // Helper to get currency symbol (simple version)
  const currencySymbol = shop?.currency || "$";

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
      setStoreDetails(data.storeDetails);
      setShop(data.shop);
      
      setRetailPrice(p.exchange?.retailPrice || ""); // Keep empty if no override
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
          retailPrice: retailPrice || storeDetails?.price, // Use live MSRP if not overridden
          wholesalePrice,
          commissionPercent,
          commissionFlat,
          isPublic
        })
      });

      if (!res.ok) throw new Error("Failed to save changes");
      setSuccess(true);
      await fetchProduct(); // Refresh data after save
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
             <BlockStack gap="400">
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

                {storeDetails && (
                  <Card>
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h2">Live Store Info</Text>
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" as="span">Store MSRP ({shop?.currency}):</Text>
                          <Text variant="bodyMd" fontWeight="bold" as="span">{currencySymbol}{storeDetails.price}</Text>
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" as="span">Compare At:</Text>
                          <Text variant="bodyMd" as="span">
                            {storeDetails.compareAtPrice ? `${currencySymbol}${storeDetails.compareAtPrice}` : "N/A"}
                          </Text>
                        </InlineStack>
                        <Divider />
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" as="span">Inventory:</Text>
                          <Badge tone={storeDetails.inventoryQuantity > 0 ? "success" : "critical"}>
                            {`${storeDetails.inventoryQuantity} available`}
                          </Badge>
                        </InlineStack>
                      </BlockStack>
                    </BlockStack>
                  </Card>
                )}
             </BlockStack>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Exchange Settings ({shop?.currency})</Text>
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label={`Retail Price Override (${currencySymbol})`}
                      value={retailPrice}
                      onChange={setRetailPrice}
                      prefix={currencySymbol}
                      placeholder={storeDetails?.price || "0.00"}
                      autoComplete="off"
                      helpText={retailPrice ? `This price overrides the store MSRP in boutiques.` : `Currently using store MSRP: ${currencySymbol}${storeDetails?.price || "0.00"}`}
                    />
                    <TextField
                      label={`Wholesale Price (${currencySymbol})`}
                      value={wholesalePrice}
                      onChange={setWholesalePrice}
                      prefix={currencySymbol}
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
                      label={`Flat Commission (${currencySymbol})`}
                      value={commissionFlat}
                      onChange={setCommissionFlat}
                      prefix={currencySymbol}
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
