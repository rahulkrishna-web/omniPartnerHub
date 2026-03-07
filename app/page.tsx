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

  return (
    <AdminLayout title="Dashboard">
      <BlockStack gap="400">
        <InlineStack gap="400">
          <Card>
            <Box padding="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Total Products</Text>
                {loading ? (
                  <SkeletonDisplayText size="small" />
                ) : (
                  <Text variant="heading2xl" as="p">{stats?.productCount || 0}</Text>
                )}
              </BlockStack>
            </Box>
          </Card>
          
          <Card>
            <Box padding="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Active Exchanges</Text>
                {loading ? (
                  <SkeletonDisplayText size="small" />
                ) : (
                  <Text variant="heading2xl" as="p">{stats?.connectionCount || 0}</Text>
                )}
              </BlockStack>
            </Box>
          </Card>
          
          <Card>
            <Box padding="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Wallet Balance</Text>
                {loading ? (
                  <SkeletonDisplayText size="small" />
                ) : (
                  <Text variant="heading2xl" as="p" tone={Number(stats?.walletBalance) < 0 ? "critical" : "success"}>
                    {formatCurrency(stats?.walletBalance || "0", stats?.currency)}
                  </Text>
                )}
              </BlockStack>
            </Box>
          </Card>
        </InlineStack>
        
        <Card>
          <Box padding="400">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">Recent Activity</Text>
              {loading ? (
                <SkeletonBodyText lines={2} />
              ) : (
                <Text variant="bodySm" as="p">No recent activity found for your hub connections.</Text>
              )}
            </BlockStack>
          </Box>
        </Card>
      </BlockStack>
    </AdminLayout>
  );
}
