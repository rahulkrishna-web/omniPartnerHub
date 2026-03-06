"use client";

import Link from "next/link";

export function AppNavigation() {
  return (
    <ui-nav-menu>
      <Link href="/" rel="home">Dashboard</Link>
      <Link href="/products">My Products</Link>
      <Link href="/hub">Product Hub</Link>
      <Link href="/partners">Partners</Link>
      <Link href="/settings">Settings</Link>
    </ui-nav-menu>
  );
}
