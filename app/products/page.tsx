"use client";

import { ProductList } from "../components/product-list";
import { AppNavigation } from "../components/app-navigation";
import { Page, Frame } from "@shopify/polaris";

export default function ProductsPage() {
  return (
    <Frame navigation={<AppNavigation />}>
      <Page>
        <ProductList />
      </Page>
    </Frame>
  );
}
