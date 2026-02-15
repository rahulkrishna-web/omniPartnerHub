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
      const url = new URL(window.location.href);
      const host = url.searchParams.get("host");
      const shop = url.searchParams.get("shop");

      console.log("Debug Params:", { host, shop, href: window.location.href });

      console.log("Checking for shopify global...", window.shopify);

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
        
        // Timeout after 2 seconds - force render anyway
        const timeout = setTimeout(() => {
           clearInterval(interval);
           if (!window.shopify) {
             console.warn("App Bridge initialization timed out. Forcing render.");
             setAppBridgeReady(true);
           }
        }, 2000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
      }
    }
  }, []);

  const [initError, setInitError] = useState(false);
  const [shop, setShop] = useState("");

  if (!appBridgeReady) {
    return (
      <AppProvider i18n={translations}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '10px' }}>
            <div>Loading OmniPartner Hub...</div>
            <div style={{fontSize: '0.8em', color: '#666'}}>Initializing App Bridge</div>
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
