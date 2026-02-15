import { AppNavigation } from "./components/app-navigation";
import { Page, Layout, Card, Text, InlineStack, BlockStack } from "@shopify/polaris";

export default function DashboardPage() {
  return (
    <Page>
      <AppNavigation />
      <div style={{ marginTop: "1rem" }}>
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                Dashboard
              </Text>
              
              <InlineStack gap="400">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">Total Products</Text>
                    <Text variant="heading2xl" as="p">0</Text>
                  </BlockStack>
                </Card>
                
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">Active Exchanges</Text>
                    <Text variant="heading2xl" as="p">0</Text>
                  </BlockStack>
                </Card>
                
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">Wallet Balance</Text>
                    <Text variant="heading2xl" as="p">$0.00</Text>
                  </BlockStack>
                </Card>
              </InlineStack>
              
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Recent Activity</Text>
                  <Text variant="bodySm" as="p" color="subdued">No recent activity</Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </div>
    </Page>
  );
}
