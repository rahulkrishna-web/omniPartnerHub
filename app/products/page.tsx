"use client";

import { ProductList } from "../components/product-list";
import { AppNavigation } from "../components/app-navigation";
import { Page } from "@shopify/polaris";

export default function ProductsPage() {
  return (
    <Page>
      <AppNavigation />
      <div style={{ marginTop: "1rem" }}>
        <ProductList />
      </div>
    </Page>
  );
}
