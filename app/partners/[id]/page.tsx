"use client";

import { useState, useEffect, useCallback } from "react";
import { AppNavigation } from "../../components/app-navigation";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  BlockStack,
  Banner,
  Spinner,
  Box,
  InlineStack,
  Grid,
} from "@shopify/polaris";
import { getSessionToken } from "../../lib/session";
import { useParams, useRouter } from "next/navigation";

export default function PartnerDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPartner = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      const res = await fetch(`/api/partners/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPartner(data.partner);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchPartner();
  }, [id, fetchPartner]);

  if (loading) {
    return (
      <>
        <AppNavigation />
        <Page backAction={{ content: "Partners", url: "/partners" }} title="Loading partner...">
          <Layout>
            <Layout.Section>
              <Box padding="800">
                <InlineStack align="center">
                  <Spinner size="large" />
                </InlineStack>
              </Box>
            </Layout.Section>
          </Layout>
        </Page>
      </>
    );
  }

  if (!partner) {
    return (
      <>
        <AppNavigation />
        <Page backAction={{ content: "Partners", url: "/partners" }} title="Partner not found">
          <Layout>
            <Layout.Section>
              <Banner tone="critical">
                <p>The partner you're looking for does not exist.</p>
              </Banner>
            </Layout.Section>
          </Layout>
        </Page>
      </>
    );
  }

  return (
    <>
      <AppNavigation />
      <Page
        backAction={{ content: "Partners", url: "/partners" }}
        title={partner.name}
        subtitle={partner.email}
        secondaryActions={[
          {
            content: "Delete Partner",
            destructive: true,
            onAction: async () => {
              if (confirm("Are you sure you want to delete this partner?")) {
                const token = await getSessionToken();
                await fetch(`/api/partners/${id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                });
                router.push("/partners");
              }
            },
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2, xl: 2 }}>
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Overview</Text>
                    <Box>
                      <Text variant="bodySm" tone="subdued" as="p">Handle</Text>
                      <Text variant="bodyMd" fontWeight="bold" as="p">@{partner.handle}</Text>
                    </Box>
                    <Box>
                      <Text variant="bodySm" tone="subdued" as="p">Tier</Text>
                      <Badge tone="info">{`Tier ${partner.tier}`}</Badge>
                    </Box>
                    <Box>
                        <Text variant="bodySm" tone="subdued" as="p">Affiliate Link</Text>
                        <code style={{ background: "#f1f1f1", padding: "4px", display: "block", marginTop: "4px", fontSize: "12px" }}>
                            https://your-shop.com?ref=${partner.handle}
                        </code>
                    </Box>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Performance (Coming Soon)</Text>
                    <Text variant="bodyMd" tone="subdued" as="p">Detailed analytics for this partner will appear here once Phase 5 is implemented.</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
            </Grid>
          </Layout.Section>
        </Layout>
      </Page>
    </>
  );
}
