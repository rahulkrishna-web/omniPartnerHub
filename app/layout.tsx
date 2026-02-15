import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
// import Script from "next/script"; // Removed to use standard script tag

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
        <script src="https://cdn.shopify.com/shopify-cloud/app-bridge.js" data-api-key={apiKey}></script>
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
