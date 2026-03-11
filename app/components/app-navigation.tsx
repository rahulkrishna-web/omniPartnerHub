"use client";

import Link from "next/link";

export function AppNavigation({ role = "supplier" }: { role?: string }) {
  return (
    <ui-nav-menu>
      <Link href="/" rel="home">Dashboard</Link>
      {role === "supplier" ? (
        <>
          <Link href="/products">My Products</Link>
          <Link href="/partners">Partner Network</Link>
        </>
      ) : (
        <>
          <Link href="/hub">Product Hub</Link>
          <Link href="/hub/orders">Hub Orders</Link>
        </>
      )}
      <Link href="/settings">Settings</Link>
    </ui-nav-menu>
  );
}
