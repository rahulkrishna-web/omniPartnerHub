"use client";

import { useEffect, useState, useCallback } from "react";
import { AppNavigation } from "../../components/app-navigation";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  EmptyState,
  Spinner,
  Banner,
  Button,
  InlineStack,
  BlockStack,
  Box,
  Link,
} from "@shopify/polaris";

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

  const resourceName = { singular: "order", plural: "orders" };

  const rowMarkup = orders.map((order, index) => {
    const status = order.status || "pending";
    const cfg = STATUS_CONFIG[status] || { label: status, tone: undefined };
    const productTitle = order.connection?.supplierProduct?.title || "—";
    const supplierName = order.supplierShop?.shop?.replace(".myshopify.com", "") || "—";

    return (
      <IndexTable.Row id={String(order.id)} key={order.id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {order.retailerOrderName || order.retailerOrderId}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{productTitle}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{supplierName}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={cfg.tone}>{cfg.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {order.trackingNumber ? (
            order.trackingUrl ? (
              <Link url={order.trackingUrl} external>
                {order.trackingNumber}
              </Link>
            ) : (
              order.trackingNumber
            )
          ) : (
            <Text variant="bodyMd" tone="subdued" as="span">—</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {order.trackingCompany || <Text variant="bodyMd" tone="subdued" as="span">—</Text>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" tone="subdued" as="span">
            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <>
      <AppNavigation />
      <Page
        title="Hub Orders"
        subtitle="Dropshipping orders routed through OmniPartner Hub."
        primaryAction={{
          content: syncing ? "Syncing..." : "Sync Fulfillments",
          onAction: handleSyncFulfillments,
          loading: syncing,
        }}
        secondaryActions={[{ content: "Refresh", onAction: fetchOrders }]}
      >
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}
          {syncResult && (
            <Layout.Section>
              <Banner tone="success" onDismiss={() => setSyncResult(null)}>
                <p>{syncResult}</p>
              </Banner>
            </Layout.Section>
          )}
          <Layout.Section>
            <Card padding="0">
              {loading ? (
                <Box padding="800">
                  <InlineStack align="center">
                    <Spinner size="large" />
                  </InlineStack>
                </Box>
              ) : orders.length === 0 ? (
                <EmptyState
                  heading="No hub orders yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>When customers order products you added from the hub, they'll appear here with their fulfillment status.</p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={orders.length}
                  headings={[
                    { title: "Retailer Order" },
                    { title: "Product" },
                    { title: "Supplier" },
                    { title: "Status" },
                    { title: "Tracking #" },
                    { title: "Carrier" },
                    { title: "Date" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </>
  );
}
