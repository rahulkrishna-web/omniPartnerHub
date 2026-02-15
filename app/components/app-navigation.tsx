"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function AppNavigation() {
  const pathname = usePathname();

  useEffect(() => {
    // Configure App Nav via window.shopify
    if (typeof window !== "undefined" && window.shopify) {
      const config = {
        children: [
          {
            role: "menu",
            children: [
              {
                label: "Dashboard",
                href: "/",
                selected: pathname === "/",
              },
              {
                label: "My Products",
                href: "/products",
                selected: pathname === "/products",
              },
              {
                label: "Product Hub",
                href: "/hub",
                selected: pathname === "/hub",
              },
              {
                label: "Partners",
                href: "/partners",
                selected: pathname === "/partners",
              },
              {
                label: "Settings",
                href: "/settings",
                selected: pathname === "/settings",
              },
            ],
          },
        ],
      };

      // Set app nav configuration
      if (window.shopify.config) {
        window.shopify.config({
          children: config.children,
        });
      }
    }
  }, [pathname]);

  return null; // App Nav is rendered by Shopify
}
