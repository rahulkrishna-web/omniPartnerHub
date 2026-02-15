"use client";

import { AppNavigation } from "../components/app-navigation";
import { Page, Layout, Card, Text, BlockStack, Frame } from "@shopify/polaris";

export default function SettingsPage() {
  return (
    <Frame navigation={<AppNavigation />}>
      <Page>
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">General Settings</Text>
                  <Text variant="bodySm" as="p">Configure your app preferences</Text>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Commission Settings</Text>
                  <Text variant="bodySm" as="p">Set default commission rates</Text>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Notifications</Text>
                  <Text variant="bodySm" as="p">Manage notification preferences</Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
