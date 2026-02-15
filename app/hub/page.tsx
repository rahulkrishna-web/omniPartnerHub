"use client";

import { AppNavigation } from "../components/app-navigation";
import { Page, Layout, Card, Text, EmptyState } from "@shopify/polaris";

export default function ProductHubPage() {
  return (
    <Page>
      <AppNavigation />
      <div style={{ marginTop: "1rem" }}>
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Product Hub"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Browse and add products from partner suppliers to your store.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </div>
    </Page>
  );
}
