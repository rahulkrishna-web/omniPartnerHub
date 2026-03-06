import React from "react";
import { Card, Text, BlockStack, InlineStack, Button, Badge, Box } from "@shopify/polaris";
import { LinkIcon } from "@shopify/polaris-icons";

interface HubProductCardProps {
  product: {
    id: number;
    title: string;
    image: string | null;
    vendor: string | null;
    retailPrice: string | null;
    wholesalePrice: string | null;
    commissionPercent: string | null;
    commissionFlat: string | null;
    supplierShop: string;
  };
  onGenerateLink: (productId: number) => void;
}

export function HubProductCard({ product, onGenerateLink }: HubProductCardProps) {
  const commissionText = product.commissionPercent 
    ? `${product.commissionPercent}%` 
    : product.commissionFlat 
      ? `$${product.commissionFlat}` 
      : "N/A";

  return (
    <Card>
      <BlockStack gap="300">
        {product.image && (
          <div
            style={{
              minHeight: "200px",
              width: "100%",
              overflow: "hidden",
              borderRadius: "8px",
              backgroundColor: "#f1f1f1",
            }}
          >
            <img
              src={product.image}
              alt={product.title}
              style={{
                width: "100%",
                height: "200px",
                objectFit: "cover",
              }}
            />
          </div>
        )}
        
        <BlockStack gap="100">
          <Text variant="headingMd" as="h3">
            {product.title}
          </Text>
          <Text variant="bodySm" as="p">
            by {product.vendor || product.supplierShop}
          </Text>
        </BlockStack>

        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text variant="bodyXs" as="p">
              Retail Price
            </Text>
            <Text variant="headingLg" as="p">
              ${product.retailPrice || "0.00"}
            </Text>
          </BlockStack>
          <Badge tone="success">{`Earn ${commissionText}`}</Badge>
        </InlineStack>

        <Button
          icon={LinkIcon}
          onClick={() => onGenerateLink(product.id)}
          fullWidth
        >
          Generate Link
        </Button>
      </BlockStack>
    </Card>
  );
}
