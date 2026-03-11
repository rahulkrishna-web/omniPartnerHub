"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { HubProductCard } from "../components/hub-product-card";
import { triggerAuthRedirect } from "../lib/session";
import {
  Box,
  InlineStack,
  Spinner,
  Text,
  Badge,
  BlockStack,
} from "@shopify/polaris";
import { SearchIcon, XIcon, ChevronDownIcon, InfoIcon } from "@shopify/polaris-icons";

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
    <AdminLayout title="Product Hub" fullWidth>
      <div className="w-full px-8 py-6 font-sans">
        {/* Top Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button className="px-4 py-2 text-sm font-medium text-gray-900 border-b-2 border-amber-800">
            Hub
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            Shared Products
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            Imported Products
          </button>
        </div>

        {/* Pro Tip Banner */}
        <div className="bg-[#FAF7F2] border border-[#F0E6D8] rounded-xl p-4 mb-8 relative flex items-start gap-3">
          <div className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 mt-0.5">
            <div className="w-5 h-5 text-amber-800 flex items-center justify-center">
              <span className="text-xs font-bold">💡</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Pro Tip: Automated Inventory</h3>
            <p className="text-sm text-gray-600">
              Products added from the Hub automatically sync inventory levels every 15 minutes. You can customize pricing rules in Settings.
            </p>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <div className="w-5 h-5">✕</div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400">🔍</span>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
            placeholder="Search all products in the Hub..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-3 mb-8">
          {["Categories", "Price Range", "Supplier", "Estimated Delivery"].map((filter) => (
            <button
              key={filter}
              className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-full text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {filter}
              <span className="ml-2 text-xs text-gray-400">▼</span>
            </button>
          ))}
        </div>

        {/* Verified Top Suppliers */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-500 tracking-wider uppercase">Verified Top Suppliers</h2>
            <button className="text-xs font-medium text-gray-400 hover:text-gray-600">View all</button>
          </div>
          <div className="flex flex-wrap gap-4">
            {["LUXURY", "NORDIC", "ESSENTIAL", "ECO-LAB", "URBAN", "TEKNIQ"].map((brand) => (
              <div
                key={brand}
                className="px-6 py-3 bg-gray-50 rounded-lg text-xs font-bold text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex justify-between items-center">
            <p>{error}</p>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex justify-between items-center">
            <p>{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)}>✕</button>
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="mt-2 text-lg font-medium text-gray-900">No products in the hub yet</h3>
            <p className="mt-1 text-sm text-gray-500">Suppliers need to mark their products as Public in My Products before they appear here.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <HubProductCard
                  key={product.id}
                  product={product}
                  isConnected={isProductConnected(product.id)}
                  isOwnProduct={currentShopId !== null && product.supplierShopId === currentShopId}
                  onAddToStore={handleAddToStore}
                  ownShop={currentShopId ? products.find(p => p.supplierShopId === currentShopId)?.supplierShop : undefined}
                  partnerHandle={partnerHandle || undefined}
                />
              ))}
            </div>

            {/* Pagination Placeholder */}
            <div className="mt-12 flex justify-center items-center gap-2">
              <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">‹</button>
              <button className="w-10 h-10 rounded-lg bg-[#D4B996] text-white font-medium">1</button>
              <button className="w-10 h-10 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">2</button>
              <button className="w-10 h-10 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">3</button>
              <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">›</button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
