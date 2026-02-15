"use client";

import { usePathname, useRouter } from "next/navigation";
import { Navigation } from "@shopify/polaris";
import { HomeMajor, ProductsMajor, CollectionsMajor, CustomersMajor, SettingsMajor } from "@shopify/polaris-icons";

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Navigation location={pathname}>
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: HomeMajor,
            onClick: () => router.push("/"),
            selected: pathname === "/",
          },
          {
            label: "My Products",
            icon: ProductsMajor,
            onClick: () => router.push("/products"),
            selected: pathname === "/products",
          },
          {
            label: "Product Hub",
            icon: CollectionsMajor,
            onClick: () => router.push("/hub"),
            selected: pathname === "/hub",
          },
          {
            label: "Partners",
            icon: CustomersMajor,
            onClick: () => router.push("/partners"),
            selected: pathname === "/partners",
          },
          {
            label: "Settings",
            icon: SettingsMajor,
            onClick: () => router.push("/settings"),
            selected: pathname === "/settings",
          },
        ]}
      />
    </Navigation>
  );
}
