"use client";

import { AppNavigation } from "../components/app-navigation";
import { Page, Layout, Card, EmptyState, Frame } from "@shopify/polaris";

export default function PartnersPage() {
  return (
    <Frame navigation={<AppNavigation />}>
      <Page>
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
      </Page>
    </Frame>
  );
}
