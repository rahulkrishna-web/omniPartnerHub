"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "./components/AdminLayout";
import { Card, Text, InlineStack, BlockStack, SkeletonBodyText, SkeletonDisplayText, Box } from "@shopify/polaris";
import { getSessionToken } from "./lib/session";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = await getSessionToken();
        const res = await fetch("/api/dashboard-stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatCurrency = (amount: string, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(amount));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <AdminLayout title="Dashboard" fullWidth titleHidden>
      <div className="w-full px-8 py-6 font-sans bg-[#F9FAFB] min-h-screen">
        {/* Welcome Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1C1E]">{getGreeting()}, Partner!</h1>
            <p className="text-sm text-gray-500 mt-1">Here's what's happening in your hub today.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 bg-[#008060] text-white rounded-xl text-sm font-bold hover:bg-[#006e52] transition-all shadow-sm hover:shadow-md active:scale-[0.98]">
              Connect New Partner
            </button>
          </div>
        </div>

        {/* Primary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { label: "TOTAL PRODUCTS", value: stats?.productCount || "0", icon: "📦", color: "blue" },
            { label: "ACTIVE EXCHANGES", value: stats?.connectionCount || "0", icon: "🔗", color: "emerald" },
            { label: "WALLET BALANCE", value: formatCurrency(stats?.walletBalance || "0", stats?.currency), icon: "💰", color: "amber", isBalance: true },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg 
                  ${stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 
                    'bg-amber-50 text-amber-600'}`}>
                  {stat.icon}
                </div>
                <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${stat.isBalance && Number(stats?.walletBalance) < 0 ? 'text-rose-600' : 'text-[#1A1C1E]'}`}>
                  {loading ? "..." : stat.value}
                </span>
                {stat.isBalance && (
                  <span className="text-[10px] font-medium text-gray-400">Available Funds</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-[#1A1C1E]">Recent Activity</h3>
                <button className="text-xs font-bold text-[#008060] hover:underline">View All</button>
              </div>
              
              <div className="flex-1 p-6">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 animate-pulse">
                        <div className="w-8 h-8 bg-gray-100 rounded-full" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 bg-gray-100 rounded w-1/4" />
                          <div className="h-2 bg-gray-100 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                      <span className="text-4xl grayscale opacity-30">🔔</span>
                    </div>
                    <h4 className="text-base font-bold text-gray-900 mb-2">No recent activity found</h4>
                    <p className="text-sm text-gray-500 max-w-[280px] leading-relaxed">
                      Activity from your partner connections and product syncs will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions / Getting Started */}
          <div className="space-y-6">
            <div className="bg-[#002E25] rounded-2xl p-6 text-white shadow-lg shadow-emerald-900/10 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-lg font-bold mb-2">Ready to Scale?</h3>
                <p className="text-sm text-emerald-100/70 mb-6 leading-relaxed">
                  Connect with vetted suppliers or invite your existing partners to the Hub.
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Explore Product Hub", icon: "🔍" },
                    { label: "Manage Partners", icon: "🤝" },
                    { label: "View API Docs", icon: "📄" },
                  ].map((action, i) => (
                    <button key={i} className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-bold transition-all border border-white/5 group">
                      <span className="group-hover:scale-125 transition-transform">{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm group hover:border-emerald-100 transition-colors">
              <h3 className="font-bold text-[#1A1C1E] mb-4 flex items-center gap-2">
                <span className="text-emerald-500">🛡️</span>
                Account Health
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Profile Completion</span>
                  <span className="font-bold text-emerald-600">85%</span>
                </div>
                <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                  <div className="w-[85%] h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                </div>
                <p className="text-[11px] text-gray-400 leading-tight">
                  Complete your billing info to unlock premium partner features.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
