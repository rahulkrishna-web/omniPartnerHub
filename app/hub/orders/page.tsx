"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import {
  Spinner,
} from "@shopify/polaris";
import { ArrowUpIcon, ArrowDownIcon } from "@shopify/polaris-icons";

type StatusTone = "success" | "attention" | "critical" | "info" | undefined;

const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  pending:   { label: "Pending",   tone: "attention" },
  ordered:   { label: "Ordered",   tone: "info" },
  fulfilled: { label: "Fulfilled", tone: "success" },
  cancelled: { label: "Cancelled", tone: "critical" },
};

export default function HubOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = await window.shopify.idToken();
      const res = await fetch("/api/hub/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncFulfillments = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const token = await window.shopify.idToken();
      const res = await fetch("/api/hub/sync-fulfillment", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncResult(`Synced ${data.synced} order(s) successfully.`);
      await fetchOrders();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);


  return (
    <AdminLayout title="Orders Hub" fullWidth>
      <div className="w-full px-8 py-6 font-sans bg-[#FBFBFB] min-h-screen">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1C1E]">Orders Hub</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your collaborative ecosystem sales and fulfillment.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-6 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              Export
            </button>
            <button className="px-6 py-2 bg-[#008060] text-white rounded-lg text-sm font-bold hover:bg-[#006e52] transition-colors">
              Create Order
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "TOTAL HUB ORDERS", value: "1,284", change: "12%", trend: "up" },
            { label: "PENDING FULFILLMENT", value: "42", status: "Action Required", pending: true },
            { label: "TOTAL REVENUE", value: "$45,230.00", change: "18%", trend: "up" },
            { label: "PARTNER COMMISSIONS", value: "$8,420.50", change: "2%", trend: "down" },
          ].map((stat, i) => (
            <div key={i} className={`bg-white p-6 rounded-2xl shadow-sm border ${stat.pending ? "border-l-4 border-l-amber-400" : "border-gray-100"}`}>
              <p className="text-[10px] font-bold text-gray-400 tracking-wider mb-2">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                {stat.change && (
                  <span className={`text-[10px] font-bold flex items-center gap-0.5 ${stat.trend === "up" ? "text-emerald-500" : "text-rose-500"}`}>
                    {stat.trend === "up" ? "↗" : "↘"}{stat.change}
                  </span>
                )}
                {stat.status && (
                  <span className="text-[10px] font-bold text-amber-600 ml-1">
                    {stat.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-8 items-start">
          {/* Main Content Column */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Table Tabs */}
              <div className="flex border-b border-gray-100 px-6">
                {["All Orders", "Outgoing Orders", "Incoming Orders"].map((tab, i) => (
                  <button
                    key={tab}
                    className={`px-4 py-4 text-sm font-bold transition-colors border-b-2 mr-6 ${i === 0 ? "text-[#008060] border-[#008060]" : "text-gray-400 border-transparent hover:text-gray-600"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Table Filters */}
              <div className="p-4 px-6 flex gap-3 border-b border-gray-100 bg-white">
                {["Status", "Payment", "Fulfillment"].map((filter) => (
                  <button key={filter} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 flex items-center gap-2 hover:bg-gray-50">
                    {filter}
                    <span className="text-[10px] text-gray-400 group-hover:text-gray-600">▼</span>
                  </button>
                ))}
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#FBFBFB] border-b border-gray-100">
                    <tr>
                      <th className="py-4 pl-6 w-12"><input type="checkbox" className="rounded border-gray-300" /></th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Order ID</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="py-4 pr-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Partner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Spinner size="large" />
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500">
                          No hub orders yet.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => {
                        const status = order.status || "pending";
                        const cfg = STATUS_CONFIG[status] || { label: status, tone: undefined };
                        const supplierName = order.supplierShop?.shop?.replace(".myshopify.com", "") || "—";
                        
                        return (
                          <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="py-4 pl-6"><input type="checkbox" className="rounded border-gray-300" /></td>
                            <td className="py-4 px-4 text-sm font-bold text-[#008060] cursor-pointer hover:underline">
                              #{order.retailerOrderName || order.retailerOrderId}
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-500">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-4 px-4 text-sm font-medium text-gray-900">
                              {order.connection?.customerName || "Sarah Jenkins"}
                            </td>
                            <td className="py-4 px-4 text-sm font-medium text-gray-900">
                              ${order.totalPrice || "124.00"}
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider 
                                ${status === 'fulfilled' ? 'bg-emerald-50 text-emerald-600' : 
                                  status === 'ordered' ? 'bg-blue-50 text-blue-600' : 
                                  status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 
                                  'bg-gray-100 text-gray-600'}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-4 pr-6 text-sm text-gray-500">
                              {supplierName}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              <div className="p-4 px-6 bg-white border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                <span>Showing 1-{orders.length} of 1,284 orders</span>
                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-400">‹</button>
                  <button className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-400">›</button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="w-[340px] flex flex-col gap-6">
            {/* Recent Activity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-emerald-500">🔄</span>
                <h3 className="font-bold text-[#1A1C1E]">Recent Activity</h3>
              </div>
              
              <div className="flex flex-col gap-6">
                {[
                  { icon: "✅", title: "Order #1082 Fulfilled", desc: "Luxe Living marked items as shipped.", time: "12 mins ago", color: "emerald" },
                  { icon: "🚚", title: "Tracking Added", desc: "Tracking added to #1081 by Urban Bloom.", time: "2 hours ago", color: "blue" },
                  { icon: "⚠️", title: "New Outgoing Order", desc: "Order #1084 needs your fulfillment.", time: "3 hours ago", color: "amber" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 
                      ${item.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 
                        item.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
                        'bg-amber-50 text-amber-600'}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-900 mb-0.5">{item.title}</p>
                      <p className="text-[12px] text-gray-500 leading-tight mb-1">{item.desc}</p>
                      <p className="text-[11px] text-gray-400">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full mt-8 py-2.5 border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                View all activity
              </button>
            </div>

            {/* Support Card */}
            <div className="bg-[#EAF5F1] rounded-2xl border border-[#D1E7DF] p-6">
              <h3 className="font-bold text-[#006E52] mb-3">Partner Support</h3>
              <p className="text-[13px] text-[#006E52] leading-relaxed mb-6 opacity-80">
                Need help with fulfillment or partner communication? Visit our documentation hub.
              </p>
              <button className="text-[13px] font-bold text-[#006E52] flex items-center gap-2 hover:gap-3 transition-all">
                Go to Documentation <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
