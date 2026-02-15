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
          if (window.shopify) {
             setAppBridgeReady(true);
             clearInterval(interval);
          }
        }, 100);
        
        // Timeout after 5 seconds
        const timeout = setTimeout(() => {
           clearInterval(interval);
           if (!window.shopify) {
             // If still missing, we set error
             console.error("App Bridge initialization timed out.");
             setInitError(true);
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

  if (initError) {
      return (
        <AppProvider i18n={translations}>
            <div style={{ 
                height: '100vh', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                background: '#f1f2f3'
            }}>
                <div style={{ width: 400, padding: 20, background: 'white', borderRadius: 8, boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ marginBottom: 20, fontSize: 20, fontWeight: 'bold' }}>Install OmniPartner Hub</h2>
                    <p style={{ marginBottom: 20, color: '#666' }}>
                        It looks like you are opening this app outside of the Shopify Admin. 
                        Enter your shop domain below to install or log in.
                    </p>
                    {/* Using standard HTML/Tailwind-ish styles for simplicity in this fallback view, 
                        since Polaris might rely on some context we want to be careful with, 
                        though AppProvider is wrapping it. */}
                    <input 
                        type="text" 
                        placeholder="my-store.myshopify.com" 
                        value={shop}
                        onChange={(e) => setShop(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            marginBottom: '10px',
                            border: '1px solid #ccc',
                            borderRadius: 4
                        }}
                    />
                    <button 
                        onClick={() => {
                            if (shop) {
                                let domain = shop;
                                if (!domain.includes(".")) {
                                    domain += ".myshopify.com";
                                }
                                window.location.href = `/api/auth?shop=${domain}`;
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: '#008060',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Install App
                    </button>
                    {process.env.NEXT_PUBLIC_SHOPIFY_API_KEY && (
                        <p style={{ marginTop: 20, fontSize: 12, color: '#999', textAlign: 'center' }}>
                            API Key Detected: Yes ({process.env.NEXT_PUBLIC_SHOPIFY_API_KEY.slice(0,4)}...)
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
