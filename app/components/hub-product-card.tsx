"use client";

import React, { useState } from "react";
import {
  Modal,
  Box,
  BlockStack,
  Text,
  InlineGrid,
  Divider,
  Badge,
  InlineStack,
} from "@shopify/polaris";
import { ViewIcon, CheckCircleIcon } from "@shopify/polaris-icons";
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
  isConnected?: boolean;
  isOwnProduct?: boolean;
  onAddToStore: (productId: number) => Promise<void>;
  ownShop?: string;
  partnerHandle?: string;
}

export function HubProductCard({ 
  product, 
  isConnected = false, 
  isOwnProduct = false, 
  onAddToStore,
  ownShop,
  partnerHandle 
}: HubProductCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const currency = product.supplierCurrency || "USD";
  const symbol = getCurrencySymbol(currency);

  // Format the supplier shop name nicely: strip .myshopify.com
  const supplierName = product.supplierShop.replace(".myshopify.com", "");

  const commissionText = product.commissionPercent
    ? `${product.commissionPercent}% per sale`
    : product.commissionFlat
      ? `${symbol}${product.commissionFlat} flat`
      : null; // null = no commission set

  const retailPrice = product.retailPrice && parseFloat(product.retailPrice) > 0
    ? `${symbol}${product.retailPrice}`
    : null;

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col h-full hover:shadow-md transition-shadow group relative">
        {/* Product Image */}
        <div 
          className="aspect-square relative overflow-hidden bg-gray-50 cursor-pointer"
          onClick={() => setDetailOpen(true)}
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              No image
            </div>
          )}
          
          {/* Badge on Image */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {!isConnected && !isOwnProduct && (
              <span className="bg-emerald-500/90 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-sm font-sans tracking-wider uppercase">
                In Stock
              </span>
            )}
            {isOwnProduct && (
              <span className="bg-amber-100/90 backdrop-blur-sm text-amber-800 text-[9px] font-bold px-2 py-1 rounded-full shadow-sm font-sans tracking-wider uppercase">
                Your Product
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1 font-sans">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-sm font-bold text-gray-900 leading-tight flex-1 mr-2 line-clamp-2">
              {product.title}
            </h3>
            {retailPrice && (
              <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                {retailPrice}
              </span>
            )}
          </div>
          
          <p className="text-[12px] text-gray-500 mb-4 flex items-center gap-1">
            <span className="text-gray-400">by</span> {product.vendor || supplierName}
          </p>

          <div className="mt-auto">
            {isOwnProduct ? (
              <div className="w-full py-2 bg-gray-50 rounded-lg text-center text-xs font-bold text-gray-400 cursor-default">
                Your Listed Product
              </div>
            ) : isConnected ? (
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-4 h-4 rounded-full border border-emerald-600 flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <span className="text-xs font-bold">Synced</span>
                </div>
                <button className="text-[11px] font-bold text-gray-300 hover:text-gray-500 underline decoration-dotted underline-offset-2">
                  View in Products
                </button>
              </div>
            ) : (
              <button
                disabled={adding}
                onClick={async () => {
                  setAdding(true);
                  try { await onAddToStore(product.id); } finally { setAdding(false); }
                }}
                className={`w-full py-3 bg-[#D4B996] hover:bg-[#C4A986] disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-[0.98]`}
              >
                {adding ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="text-lg leading-none">+</span>
                    Add to Store
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Quick View Hover Button */}
        <button 
          onClick={() => setDetailOpen(true)}
          className="absolute top-3 left-3 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-white/50"
        >
          <span className="text-xs">👁️</span>
        </button>
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={product.title}
        primaryAction={{
          content: "Copy Affiliate Link",
          onAction: () => {
            const handle = partnerHandle || ownShop || "partner";
            // Link to the Boutique store hosted on the supplier's shop
            const link = `https://${product.supplierShop}/apps/omnipartner-hub/store/${handle}?product_id=${product.shopifyProductId}`;
            navigator.clipboard.writeText(link);
            alert(`Link copied to clipboard!\n${link}`);
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
