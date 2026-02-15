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
      console.log("Checking for shopify global...", window.shopify);
      if (window.shopify) {
        setAppBridgeReady(true);
      } else {
        // Poll for shopify global
        const interval = setInterval(() => {
          console.log("Polling shopify global...", window.shopify);
          if (window.shopify) {
            setAppBridgeReady(true);
            clearInterval(interval);
          }
        }, 100);

        // Timeout after 5 seconds
        const timeout = setTimeout(() => {
           clearInterval(interval);
           console.error("App Bridge initialization timed out. API Key:", process.env.NEXT_PUBLIC_SHOPIFY_API_KEY);
           // Force ready to show error UI or just let it render children if safe? 
           // If we render children without app bridge, it might crash again.
           // Better to show an error UI.
           setAppBridgeReady(false); // Should be false already
           // We need a state to show error
           setInitError(true);
        }, 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
      }
    }
  }, []);

  const [initError, setInitError] = useState(false);

  if (initError) {
      return (
        <AppProvider i18n={translations}>
            <div style={{ padding: 20, textAlign: "center" }}>
                <h1>App Bridge Initialization Failed</h1>
                <p>Ensure you are opening this app from the Shopify Admin.</p>
                <p>API Key Configured: {process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ? "Yes (" + process.env.NEXT_PUBLIC_SHOPIFY_API_KEY.slice(0,4) + "...)" : "No"}</p>
            </div>
        </AppProvider>
      );
  }

  if (!appBridgeReady) {
    return (
      <AppProvider i18n={translations}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            Loading App Bridge...
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
