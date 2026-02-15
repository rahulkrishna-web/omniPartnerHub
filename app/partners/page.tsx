import { AppNavigation } from "../components/app-navigation";
import { Page, Layout, Card, Text, EmptyState, Button } from "@shopify/polaris";

export default function PartnersPage() {
  return (
    <Page>
      <AppNavigation />
      <div style={{ marginTop: "1rem" }}>
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Manage Partners"
                action={{ content: "Add Partner", onAction: () => {} }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add partners and generate unique affiliate links for them.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </div>
    </Page>
  );
}
