"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import {
  Page,
  Card,
  Tabs,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
  Filters,
  TextField,
  Box,
  Spinner,
  EmptyState,
} from "@shopify/polaris";
import { getSessionToken } from "../../lib/session";

type StatusTone = "success" | "attention" | "critical" | "info" | undefined;

const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  pending:   { label: "Open",      tone: "attention" },
  ordered:   { label: "Ordered",   tone: "info" },
  fulfilled: { label: "Fulfilled", tone: "success" },
  cancelled: { label: "Cancelled", tone: "critical" },
};

export default function HubOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const res = await fetch("/api/hub/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const tabs = [
    { id: "all", content: "All", accessibilityLabel: "All orders", panelID: "all-orders-content" },
    { id: "incoming", content: "Incoming Orders", panelID: "incoming-orders-content" },
    { id: "outgoing", content: "Outgoing Orders", panelID: "outgoing-orders-content" },
  ];

  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const rowMarkup = orders.map(
    ({ id, retailerOrderName, createdAt, connection, totalPrice, status }, index) => {
      const cfg = STATUS_CONFIG[status] || { label: status || "Open", tone: "attention" };
      return (
        <IndexTable.Row
          id={id}
          key={id}
          selected={selectedResources.includes(id)}
          position={index}
        >
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              #{retailerOrderName || id}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            {createdAt ? new Date(createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', ' at') : "—"}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {connection?.customerName || "—"}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={cfg.tone}>{cfg.label}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              ${totalPrice || "0.00"} USD
            </Text>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <AdminLayout title="Orders" fullWidth titleHidden>
      <Page
        title="Orders"
        primaryAction={{ content: "Create order" }}
        secondaryActions={[{ content: "Export" }]}
      >
        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box padding="200" borderBlockStartWidth="025" borderColor="border-secondary">
              <Filters
                queryValue={searchQuery}
                filters={[]}
                onQueryChange={setSearchQuery}
                onQueryClear={() => setSearchQuery("")}
                onClearAll={() => {}}
              />
            </Box>
            
            {loading ? (
              <Box padding="800">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Spinner size="large" />
                </div>
              </Box>
            ) : orders.length === 0 ? (
              <EmptyState
                heading="Learn more about creating draft orders"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>No orders matched your filters or search.</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={orders.length}
                selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Draft order" },
                  { title: "Date" },
                  { title: "Customer" },
                  { title: "Status" },
                  { title: "Total", alignment: "end" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
            
            <Box padding="400" borderBlockStartWidth="025" borderColor="border-secondary">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Text variant="bodySm" as="span" tone="subdued">1-10</Text>
              </div>
            </Box>
          </Tabs>
        </Card>
      </Page>
    </AdminLayout>
  );
}
