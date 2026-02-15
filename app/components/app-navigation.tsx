"use client";

import { usePathname, useRouter } from "next/navigation";
import { Navigation } from "@shopify/polaris";
import { HomeIcon, ProductIcon, CollectionIcon, CustomersIcon, SettingsIcon } from "@shopify/polaris-icons";

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Navigation location={pathname}>
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: HomeIcon,
            onClick: () => router.push("/"),
            selected: pathname === "/",
          },
          {
            label: "My Products",
            icon: ProductIcon,
            onClick: () => router.push("/products"),
            selected: pathname === "/products",
          },
          {
            label: "Product Hub",
            icon: CollectionIcon,
            onClick: () => router.push("/hub"),
            selected: pathname === "/hub",
          },
          {
            label: "Partners",
            icon: CustomersIcon,
            onClick: () => router.push("/partners"),
            selected: pathname === "/partners",
          },
          {
            label: "Settings",
            icon: SettingsIcon,
            onClick: () => router.push("/settings"),
            selected: pathname === "/settings",
          },
        ]}
      />
    </Navigation>
  );
}
