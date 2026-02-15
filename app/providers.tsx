"use client";

import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import translations from "@shopify/polaris/locales/en.json";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
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

  // If we are not in an iframe or don't have host/apiKey, we might render basic children or a loader
  // For simplicity, we wrap with Polaris always. App Bridge only if config exists.

  return (
    <AppProvider i18n={translations}>
      {config ? (
        <AppBridgeProvider config={config}>
          {children}
        </AppBridgeProvider>
      ) : (
        <>{children}</>
      )}
    </AppProvider>
  );
}
