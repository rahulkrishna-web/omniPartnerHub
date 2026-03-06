"use client";

import React, { useState } from "react";
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Box,
  Modal,
  Divider,
  Thumbnail,
  InlineGrid,
} from "@shopify/polaris";
import { LinkIcon, ViewIcon } from "@shopify/polaris-icons";
import { getCurrencySymbol } from "../lib/currency";

interface HubProduct {
  id: number;
  shopifyProductId: string;
  title: string;
  image: string | null;
  vendor: string | null;
  retailPrice: string | null;
  wholesalePrice: string | null;
  commissionPercent: string | null;
  commissionFlat: string | null;
  supplierShop: string;
  supplierCurrency: string | null;
  supplierMoneyFormat: string | null;
}

interface HubProductCardProps {
  product: HubProduct;
  onGenerateLink: (productId: number) => void;
  isConnected?: boolean;
  isOwnProduct?: boolean;
  onAddToStore: (productId: number) => Promise<void>;
}

export function HubProductCard({ product, onGenerateLink, isConnected = false, isOwnProduct = false, onAddToStore }: HubProductCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const currency = product.supplierCurrency || "USD";
  const symbol = getCurrencySymbol(currency);

  // Format the supplier shop name nicely: strip .myshopify.com
  const supplierName = product.supplierShop.replace(".myshopify.com", "");

  const commissionText = product.commissionPercent
    ? `${product.commissionPercent}%`
    : product.commissionFlat
      ? `${symbol}${product.commissionFlat}`
      : "N/A";

  return (
    <>
      <Card>
        <BlockStack gap="300">
          {/* Product Image */}
          {product.image && (
            <div
              style={{
                minHeight: "200px",
                width: "100%",
                overflow: "hidden",
                borderRadius: "8px",
                backgroundColor: "#f1f1f1",
                cursor: "pointer",
              }}
              onClick={() => setDetailOpen(true)}
            >
              <img
                src={product.image}
                alt={product.title}
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
            </div>
          )}

          {/* Title + Vendor */}
          <BlockStack gap="100">
            <Text variant="headingMd" as="h3">
              {product.title}
            </Text>
            <Text variant="bodySm" tone="subdued" as="p">
              by {product.vendor || supplierName}
            </Text>
            {/* Supplier Store + Connection Status */}
          <InlineStack gap="100" blockAlign="center">
            <Text variant="bodyXs" tone="subdued" as="span">Sold by:</Text>
            <Badge tone="info">{supplierName}</Badge>
            {isOwnProduct && <Badge tone="magic">Your Product</Badge>}
            {isConnected && !isOwnProduct && <Badge tone="success">Added ✓</Badge>}
          </InlineStack>
          </BlockStack>

          {/* Price + Commission */}
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="050">
              <Text variant="bodyXs" tone="subdued" as="p">Retail Price</Text>
              <Text variant="headingLg" as="p">
                {symbol}{product.retailPrice || "0.00"}
              </Text>
              <Text variant="bodyXs" tone="subdued" as="p">{currency}</Text>
            </BlockStack>
            <Badge tone="success">{`Earn ${commissionText}`}</Badge>
          </InlineStack>

          {/* Actions */}
          <InlineStack gap="200">
            <Button
              icon={ViewIcon}
              onClick={() => setDetailOpen(true)}
              variant="secondary"
              size="slim"
            >
              Details
            </Button>
            {isOwnProduct ? (
              <Button variant="secondary" size="slim" disabled>
                Your Listed Product
              </Button>
            ) : isConnected ? (
              <Button variant="secondary" size="slim" disabled>
                Added to Store ✓
              </Button>
            ) : (
              <Button
                variant="primary"
                size="slim"
                loading={adding}
                onClick={async () => {
                  setAdding(true);
                  try { await onAddToStore(product.id); } finally { setAdding(false); }
                }}
              >
                Add to My Store
              </Button>
            )}
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={product.title}
        primaryAction={{
          content: "Generate Affiliate Link",
          onAction: () => {
            onGenerateLink(product.id);
            setDetailOpen(false);
          },
        }}
        secondaryActions={[
          { content: "Close", onAction: () => setDetailOpen(false) },
        ]}
        size="large"
      >
        <Modal.Section>
          <InlineGrid columns={["oneThird", "twoThirds"]} gap="400">
            {/* Left: Image */}
            <Box>
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  style={{ width: "100%", borderRadius: "8px", objectFit: "cover" }}
                />
              ) : (
                <Box
                  background="bg-surface-secondary"
                  borderRadius="200"
                  minHeight="200px"
                />
              )}
            </Box>

            {/* Right: Details */}
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text variant="headingLg" as="h2">{product.title}</Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  {product.vendor || supplierName}
                </Text>
              </BlockStack>

              <InlineStack gap="150" blockAlign="center">
                <Text variant="bodyMd" as="span">Sold by:</Text>
                <Badge tone="info">{supplierName}</Badge>
                <Badge>{currency}</Badge>
              </InlineStack>

              <Divider />

              {/* Pricing */}
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Pricing</Text>
                <InlineGrid columns={2} gap="200">
                  <BlockStack gap="050">
                    <Text variant="bodyXs" tone="subdued" as="p">Retail Price</Text>
                    <Text variant="headingMd" as="p">
                      {symbol}{product.retailPrice || "0.00"}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text variant="bodyXs" tone="subdued" as="p">Your Wholesale Price</Text>
                    <Text variant="headingMd" as="p">
                      {symbol}{product.wholesalePrice || "N/A"}
                    </Text>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>

              <Divider />

              {/* Commission */}
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Your Commission</Text>
                <InlineGrid columns={2} gap="200">
                  {product.commissionPercent && (
                    <BlockStack gap="050">
                      <Text variant="bodyXs" tone="subdued" as="p">Percentage</Text>
                      <Badge tone="success">{product.commissionPercent + "% per sale"}</Badge>
                    </BlockStack>
                  )}
                  {product.commissionFlat && (
                    <BlockStack gap="050">
                      <Text variant="bodyXs" tone="subdued" as="p">Flat Rate</Text>
                      <Badge tone="success">{symbol + product.commissionFlat + " per sale"}</Badge>
                    </BlockStack>
                  )}
                  {!product.commissionPercent && !product.commissionFlat && (
                    <Text variant="bodyMd" tone="subdued" as="p">No commission set</Text>
                  )}
                </InlineGrid>
              </BlockStack>
            </BlockStack>
          </InlineGrid>
        </Modal.Section>
      </Modal>
    </>
  );
}
