"use client";

import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import translations from "@shopify/polaris/locales/en.json";
// import { AppProvider as AppBridgeProvider } from "@shopify/app-bridge-react"; // v4
import { useState, useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<{ apiKey: string; host: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const host = urlParams.get("host");
      const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

      if (host && apiKey) {
        setConfig({ apiKey, host });
      }
    }
  }, []);

  return (
    <AppProvider i18n={translations}>
        {children}
    </AppProvider>
  );
}
