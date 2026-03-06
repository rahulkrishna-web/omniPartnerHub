"use client";

import { useState, useEffect, useCallback } from "react";
import { AppNavigation } from "../components/app-navigation";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
  Button,
  Modal,
  FormLayout,
  TextField,
  BlockStack,
  Banner,
  Spinner,
  EmptyState,
  Box,
  InlineStack,
  Link,
} from "@shopify/polaris";
import { getSessionToken } from "../lib/session";

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [shop, setShop] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newHandle, setNewHandle] = useState("");

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      const res = await fetch("/api/partners", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPartners(data.partners || []);
      setShop(data.shop || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleAddPartner = async () => {
    setModalLoading(true);
    try {
      const token = await getSessionToken();
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName, email: newEmail, handle: newHandle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setIsModalOpen(false);
      setNewName("");
      setNewEmail("");
      setNewHandle("");
      fetchPartners();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const resourceName = { singular: "partner", plural: "partners" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(partners);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const rowMarkup = partners.map(({ id, name, email, handle, tier }, index) => {
    const boutiqueUrl = `https://${shop}/apps/omnipartner-hub/store/${handle}`;
    return (
      <IndexTable.Row
        id={id.toString()}
        key={id}
        selected={selectedResources.includes(id.toString())}
        position={index}
      >
        <IndexTable.Cell>
          <Button variant="plain" url={`/partners/${id}`} textAlign="start">
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {name}
            </Text>
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>{email}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">{`Tier ${tier}`}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack align="start" gap="200">
            <code style={{ fontSize: "12px" }}>{boutiqueUrl}</code>
            <Button size="slim" onClick={() => copyToClipboard(boutiqueUrl)}>
              Copy
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <>
      <AppNavigation />
      <Page
        title="Partners"
        primaryAction={{
          content: "Add Partner",
          onAction: () => setIsModalOpen(true),
        }}
      >
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card padding="0">
              {loading ? (
                <Box padding="400">
                  <InlineStack align="center">
                    <Spinner size="large" />
                  </InlineStack>
                </Box>
              ) : partners.length === 0 ? (
                <EmptyState
                  heading="No partners found"
                  action={{
                    content: "Add your first partner",
                    onAction: () => setIsModalOpen(true),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Start recruiting partners to promote your products.</p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={partners.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Name" },
                    { title: "Email" },
                    { title: "Tier" },
                    { title: "Boutique URL" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>

        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add New Partner"
          primaryAction={{
            content: "Create Partner",
            onAction: handleAddPartner,
            loading: modalLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Full Name"
                value={newName}
                onChange={setNewName}
                autoComplete="name"
              />
              <TextField
                label="Email"
                type="email"
                value={newEmail}
                onChange={setNewEmail}
                autoComplete="email"
              />
              <TextField
                label="Partner Handle (for Link)"
                value={newHandle}
                onChange={setNewHandle}
                prefix="@"
                helpText="This will be used in their affiliate URL (e.g. ?ref=handle)"
                autoComplete="off"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      </Page>
    </>
  );
}
