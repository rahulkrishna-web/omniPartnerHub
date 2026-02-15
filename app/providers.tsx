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
        
  // ... inside effect ...
        // Timeout after 2 seconds
        const timeout = setTimeout(() => {
           clearInterval(interval);
           if (!window.shopify) {
             console.warn("App Bridge initialization timed out.");
             setInitError(true); // Show error UI instead of forcing render
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

  // Helper to handle installation/repair
  const handleInstall = () => {
        if (!shop) return;
        let domain = shop;
        if (!domain.includes(".")) {
            domain += ".myshopify.com";
        }
        // Redirect to auth
        if (typeof window !== "undefined") {
            // If embedded, we need to break out. If standalone, just assign.
            // But for safety, _top always works to break out or stay top.
            window.open(`/api/auth?shop=${domain}`, '_top');
        }
  };

  if (initError || (!appBridgeReady && typeof window !== 'undefined' && window.top === window.self)) {
      // Show Install/Repair Screen if:
      // 1. App Bridge Timed Out (InitError) inside Shopify
      // 2. Opened directly (window.top === window.self)
      
      const isEmbedded = typeof window !== 'undefined' && window.top !== window.self;

      return (
        <AppProvider i18n={translations}>
            <div style={{ 
                height: '100vh', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                background: '#f1f2f3',
                fontFamily: '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
            }}>
                <div style={{ width: 400, padding: 30, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600, color: '#202223' }}>
                        {isEmbedded ? "Connection Interrupted" : "Install OmniPartner Hub"}
                    </h2>
                    <p style={{ marginBottom: 24, fontSize: 14, lineHeight: '20px', color: '#6D7175' }}>
                        {isEmbedded 
                            ? "The app is having trouble connecting to Shopify. Refresing your session usually fixes this." 
                            : "Enter your shop domain to log in or install the app."}
                    </p>

                    <label style={{display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: '#202223'}}>Shop Domain</label>
                    <div style={{display: 'flex', marginBottom: 20}}>
                        <input 
                            type="text" 
                            placeholder="my-store.myshopify.com" 
                            value={shop}
                            onChange={(e) => setShop(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #C9CCCF',
                                borderRadius: 4,
                                fontSize: 14,
                                outline: 'none'
                            }}
                        />
                    </div>
                    
                    <button 
                        onClick={handleInstall}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: '#008060',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 14
                        }}
                    >
                        {isEmbedded ? "Repair Connection" : "Install App"}
                    </button>
                    {!isEmbedded && (
                        <p style={{marginTop: 16, fontSize: 12, color: '#6D7175', textAlign: 'center'}}>
                            Running outside of Shopify Admin
                        </p>
                    )}
                </div>
            </div>
        </AppProvider>
      );
  }

  if (!appBridgeReady) {
    return (
      <AppProvider i18n={translations}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '10px' }}>
            <div style={{fontWeight: 500}}>Loading OmniPartner Hub...</div>
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
