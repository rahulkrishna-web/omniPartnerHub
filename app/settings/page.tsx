import { AppNavigation } from "../components/app-navigation";
import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";

export default function SettingsPage() {
  return (
    <Page>
      <AppNavigation />
      <div style={{ marginTop: "1rem" }}>
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">General Settings</Text>
                  <Text variant="bodySm" as="p" color="subdued">Configure your app preferences</Text>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Commission Settings</Text>
                  <Text variant="bodySm" as="p" color="subdued">Set default commission rates</Text>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Notifications</Text>
                  <Text variant="bodySm" as="p" color="subdued">Manage notification preferences</Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </div>
    </Page>
  );
}
