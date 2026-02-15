import Script from "next/script";

// ...

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
        <Script 
          src="https://cdn.shopify.com/shopify-cloud/app-bridge.js" 
          data-api-key={apiKey} 
          strategy="beforeInteractive" 
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
