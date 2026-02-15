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
        
        // Timeout after 5 seconds
        const timeout = setTimeout(() => {
           clearInterval(interval);
           if (!window.shopify) {
             console.error("App Bridge initialization timed out.");
             // We don't block here anymore to show debug UI if needed
           }
        }, 5000);

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
    const isBrowser = typeof window !== "undefined";
    const currentUrl = isBrowser ? window.location.href : "";
    const urlObj = isBrowser ? new URL(window.location.href) : null;
    const currentHost = urlObj?.searchParams.get("host");
    const currentShop = urlObj?.searchParams.get("shop");

    return (
      <AppProvider i18n={translations}>
        <div style={{ padding: 20, fontFamily: 'system-ui' }}>
            <h2>App Bridge Loading...</h2>
            <div style={{ marginTop: 20, padding: 10, background: '#f5f5f5', borderRadius: 4, fontSize: 12 }}>
                <p><strong>Status:</strong> Waiting for window.shopify...</p>
                <p><strong>Current URL:</strong> {currentUrl}</p>
                <p><strong>Host Param:</strong> {currentHost || "MISSING"}</p>
                <p><strong>Shop Param:</strong> {currentShop || "MISSING"}</p>
                <p style={{marginTop: 10}}>
                    <button 
                         onClick={() => {
                            if (currentShop && !currentHost) {
                                const shopName = currentShop.replace(".myshopify.com", "");
                                const rawHost = `admin.shopify.com/store/${shopName}`;
                                const newHost = btoa(rawHost).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                                const newUrl = new URL(window.location.href);
                                newUrl.searchParams.set("host", newHost);
                                window.location.href = newUrl.toString();
                            } else {
                                window.location.reload();
                            }
                         }}
                         style={{ padding: '8px 16px', background: '#008060', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                        {currentShop && !currentHost ? "Fix Host & Reload" : "Reload Page"}
                    </button>
                </p>
                <p style={{marginTop: 10, color: 'red'}}>If this screen persists, please share a screenshot of this debug info.</p>
            </div>
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
