"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { Card, Text, BlockStack, Button, Banner, Select, Box, InlineStack, TextField, Layout } from "@shopify/polaris";
import { getSessionToken } from "../lib/session";

export default function SettingsPage() {
  const [role, setRole] = useState("supplier");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const token = await getSessionToken();
        const res = await fetch("/api/dashboard-stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.role) setRole(data.role);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess(true);
      // Wait a moment then refresh to update the entire app state
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Settings" subtitle="Manage your shop's configuration and preferences.">
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        )}
        {success && (
          <Banner tone="success" onDismiss={() => setSuccess(false)}>
            <p>Settings saved successfully! Refreshing to apply changes...</p>
          </Banner>
        )}

        <Layout>
          <Layout.AnnotatedSection
            title="Account Role"
            description="Choose how you want to interact with the Hub. Suppliers list products, while Partners promote them."
          >
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <Select
                    label="Current Role"
                    options={[
                      { label: "Supplier (I have products to share)", value: "supplier" },
                      { label: "Partner (I want to promote products)", value: "partner" },
                    ]}
                    value={role}
                    onChange={setRole}
                    disabled={loading}
                    helpText="Changing your role will update your dashboard and available menu options."
                  />
                  <InlineStack align="end">
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                      Save Changes
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Box>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="General Configuration"
            description="Manage global settings for your shop's integration with OmniPartner Hub."
          >
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <TextField 
                    label="Money Format"
                    value="${{amount}}"
                    disabled
                    autoComplete="off"
                    helpText="This is fetched automatically from your Shopify store settings."
                  />
                  <TextField 
                    label="Currency"
                    value="USD"
                    disabled
                    autoComplete="off"
                    helpText="Your store's default currency."
                  />
                </BlockStack>
              </Box>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </AdminLayout>
  );
}
