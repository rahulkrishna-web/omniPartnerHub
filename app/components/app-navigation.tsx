"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@shopify/polaris";
import { useCallback, useMemo } from "react";

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = useMemo(
    () => [
      {
        id: "dashboard",
        content: "Dashboard",
        path: "/",
      },
      {
        id: "products",
        content: "My Products",
        path: "/products",
      },
      {
        id: "hub",
        content: "Product Hub",
        path: "/hub",
      },
      {
        id: "partners",
        content: "Partners",
        path: "/partners",
      },
      {
        id: "settings",
        content: "Settings",
        path: "/settings",
      },
    ],
    []
  );

  const selectedTab = useMemo(() => {
    const index = tabs.findIndex((tab) => tab.path === pathname);
    return index >= 0 ? index : 0;
  }, [pathname, tabs]);

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => {
      router.push(tabs[selectedTabIndex].path);
    },
    [router, tabs]
  );

  return (
    <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
      {/* Children will be rendered by the page */}
    </Tabs>
  );
}
