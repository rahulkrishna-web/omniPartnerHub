import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OmniPartner Hub",
  description: "B2B Ecosystem for Shopify",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={apiKey} />
      </head>
      <body className={inter.className}>
        <Script 
          src="https://cdn.shopify.com/shopify-cloud/app-bridge.js" 
          strategy="beforeInteractive"
          data-api-key={apiKey}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
