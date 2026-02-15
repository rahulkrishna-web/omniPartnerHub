"use client";

import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import translations from "@shopify/polaris/locales/en.json";
import { useState, useEffect } from "react";

// Extend window interface to avoid TS error
declare global {
  interface Window {
    shopify?: any;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [appBridgeReady, setAppBridgeReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.shopify) {
        setAppBridgeReady(true);
      } else {
        // Poll for shopify global
        const interval = setInterval(() => {
          if (window.shopify) {
            setAppBridgeReady(true);
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, []);

  if (!appBridgeReady) {
    return (
      <AppProvider i18n={translations}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            {/* Optional: Add a spinner here */}
            Loading...
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider i18n={translations}>
        {children}
    </AppProvider>
  );
}
