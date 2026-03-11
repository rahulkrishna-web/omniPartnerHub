"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Thumbnail,
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
import { getSessionToken, triggerAuthRedirect } from "../lib/session";

import { getCurrencySymbol } from "../lib/currency";

export function ProductList() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<any>(null);
  const currencySymbol = shop?.currency ? getCurrencySymbol(shop.currency) : "$";

  // Debounce timers map keyed by productId+field
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products);

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/products", { headers });

      // 401 = OAuth never completed for this store — trigger the auth flow
      if (res.status === 401) {
        await triggerAuthRedirect();
        return;
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.products || []);
      setShop(data.shop);
    } catch (err: any) {
      console.error("Fetch products error:", err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);


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
      if (res.status === 401) {
        await triggerAuthRedirect();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Sync failed (${res.status})`);
      }
      await fetchProducts();
    } catch (err: any) {
      setError(err.message);
    }
    setSyncing(false);
  }

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  /** Debounced: only calls API 500ms after user stops typing */
  function updatePrice(productId: number, field: 'retailPrice' | 'wholesalePrice', value: string) {
    // Optimistic update immediately
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, exchange: { ...p.exchange, [field]: value } }
          : p
      )
    );

    // Debounce the API call
    const key = `${productId}-${field}`;
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const token = await getSessionToken();
        const product = products.find((p) => p.id === productId);
        const updatedExchange = { ...product?.exchange, [field]: value };

        const res = await fetch("/api/products", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId,
            retailPrice: updatedExchange.retailPrice,
            wholesalePrice: updatedExchange.wholesalePrice,
            isPublic: updatedExchange.isPublic
          }),
        });
        if (!res.ok) throw new Error("Price update failed");
      } catch (err: any) {
        setError(err.message);
        // Rollback on error
        await fetchProducts(true);
      }
    }, 500);
  }

  const rowMarkup = products.map(
    ({ id, title, image, vendor, exchange, isHubSourced }, index) => {
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
            {currencySymbol}{exchange?.wholesalePrice || "0.00"}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <TextField
              label="Retail"
              labelHidden
              value={exchange?.retailPrice || ""}
              onChange={(val: string) => updatePrice(id, 'retailPrice', val)}
              prefix={currencySymbol}
              autoComplete="off"
              placeholder="0.00"
            />
          </IndexTable.Cell>
          <IndexTable.Cell>
            {isHubSourced ? (
              <Badge tone="info">Dropshipped</Badge>
            ) : (
              <Badge tone={exchange?.isPublic ? "success" : "attention"}>
                {exchange?.isPublic ? "Public" : "Private"}
              </Badge>
            )}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {isHubSourced ? (
              <Button size="slim" disabled>
                Dropshipped ·  Cannot Publish
              </Button>
            ) : (
              <Button
                size="slim"
                loading={isUpdating}
                onClick={() => toggleVisibility(id, exchange?.isPublic)}
              >
                {exchange?.isPublic ? "Make Private" : "Make Public"}
              </Button>
            )}
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <div className="w-full px-8 py-6 font-sans bg-[#F9FAFB] min-h-screen">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1C1E]">Integrated Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all your local and hub-sourced products in one unified view.</p>
        </div>
        <div className="flex gap-3">
          <button 
            disabled={syncing}
            onClick={handleSync}
            className={`px-6 py-2.5 bg-[#008060] text-white rounded-xl text-sm font-bold hover:bg-[#006e52] transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-2`}
          >
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <span className="text-lg leading-none">🔄</span>
                Sync from Shopify
              </>
            )}
          </button>
        </div>
      </div>

      {/* Catalog Stats Overiew */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "TOTAL LISTINGS", value: products.length.toString(), icon: "📦", color: "blue" },
          { label: "PUBLIC TO HUB", value: products.filter(p => p.exchange?.isPublic).length.toString(), icon: "🌐", color: "emerald" },
          { label: "DROPSHIPPED", value: products.filter(p => p.isHubSourced).length.toString(), icon: "🚀", color: "purple" },
          { label: "PENDING UPDATES", value: updatingIds.length.toString(), icon: "⏳", color: "amber" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm group hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                ${stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
                  stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 
                  stat.color === 'purple' ? 'bg-purple-50 text-purple-600' :
                  'bg-amber-50 text-amber-600'}`}>
                {stat.icon}
              </span>
              <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1C1E]">{loading ? "..." : stat.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <span>⚠️</span>
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 px-6 flex justify-between items-center border-b border-gray-50 bg-white">
          <div className="flex gap-4 items-center">
            <span className="text-sm font-bold text-[#1A1C1E]">All Products</span>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex gap-2">
              {["All", "Local", "Hub Sourced"].map((t) => (
                <button key={t} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors ${t === 'All' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          
          {selectedResources.length > 0 && (
            <div className="flex gap-2 items-center px-3 py-1 bg-emerald-50 rounded-lg animate-in fade-in zoom-in-95">
              <span className="text-xs font-bold text-emerald-700">{selectedResources.length} Selected</span>
              <button 
                onClick={() => handleBulkUpdate(true)}
                className="px-2 py-1 text-[10px] font-bold bg-white text-emerald-700 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
              >
                Publish All
              </button>
              <button 
                onClick={() => handleBulkUpdate(false)}
                className="px-2 py-1 text-[10px] font-bold bg-white text-gray-600 rounded border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                Hide All
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
              🔍 Search Catalog
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FBFBFB] border-b border-gray-100">
              <tr>
                <th className="py-4 pl-6 w-12">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300" 
                    checked={allResourcesSelected} 
                    onChange={(e) => {
                      const type = e.target.checked ? 'all' : 'none';
                      // @ts-ignore - bridge Polaris hook to custom checkbox
                      handleSelectionChange(type, e.target.checked);
                    }} 
                  />
                </th>
                <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product</th>
                <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Vendor</th>
                <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Wholesale</th>
                <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Retail Price</th>
                <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Visibility</th>
                <th className="py-4 pr-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Spinner size="large" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="flex flex-col items-center max-w-[320px] mx-auto">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <span className="text-3xl grayscale opacity-30 text-emerald-500">📦</span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mb-2">No products found</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        Sync your products from Shopify to start managing your catalog and sharing with partners.
                      </p>
                      <button 
                        onClick={handleSync}
                        className="mt-6 px-5 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                      >
                        Sync Catalog Now
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map(({ id, title, image, vendor, exchange, isHubSourced }, index) => {
                  const isUpdating = updatingIds.includes(id);
                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-5 pl-6">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300" 
                          checked={selectedResources.includes(id as string)}
                          onChange={(e) => {
                            // @ts-ignore - bridge Polaris hook to custom checkbox
                            handleSelectionChange('single', e.target.checked, id as string);
                          }}
                        />
                      </td>
                      <td className="py-5 px-4 underline-offset-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0 group-hover:scale-110 transition-transform">
                            <img src={image || ""} alt={title} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <a href={`/products/${id}`} className="text-sm font-bold text-[#1A1C1E] hover:text-[#008060] transition-colors line-clamp-1 max-w-[200px]">
                              {title}
                            </a>
                            <p className="text-[11px] text-gray-400 mt-0.5">{isHubSourced ? 'Hub Sourced' : 'Shopify Local'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-sm text-gray-500">{vendor}</td>
                      <td className="py-5 px-4 text-sm font-bold text-[#1A1C1E]">
                        {currencySymbol}{exchange?.wholesalePrice || "0.00"}
                      </td>
                      <td className="py-5 px-4">
                        <div className="relative max-w-[100px]">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">{currencySymbol}</span>
                          <input 
                            type="text" 
                            className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            value={exchange?.retailPrice || ""}
                            onChange={(e) => updatePrice(id, 'retailPrice', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="py-5 px-4">
                        {isHubSourced ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wider">
                            Dropshipped
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${exchange?.isPublic ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                            {exchange?.isPublic ? "Public" : "Private"}
                          </span>
                        )}
                      </td>
                      <td className="py-5 pr-6 text-right">
                        {isHubSourced ? (
                          <span className="text-[10px] text-gray-300 font-bold italic">Source Protected</span>
                        ) : (
                          <button 
                            disabled={isUpdating}
                            onClick={() => toggleVisibility(id, exchange?.isPublic)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                              ${exchange?.isPublic 
                                ? 'bg-gray-50 text-gray-600 hover:bg-gray-100' 
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                          >
                            {isUpdating ? "..." : exchange?.isPublic ? "Hide" : "Publish to Hub"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 px-6 bg-white border-t border-gray-50 flex justify-between items-center text-[12px] text-gray-500">
          <span>Showing {products.length} of {products.length} products</span>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded border border-gray-100 flex items-center justify-center hover:bg-gray-50 text-gray-400">‹</button>
            <button className="w-8 h-8 rounded border border-gray-100 flex items-center justify-center hover:bg-gray-50 text-gray-400">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
