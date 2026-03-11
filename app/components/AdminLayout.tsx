"use client";

import { useState, useEffect } from "react";
import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";
import { AppNavigation } from "./app-navigation";
import { getSessionToken } from "../lib/session";

export function AdminLayout({ 
  children, 
  title, 
  subtitle,
  primaryAction,
  fullWidth 
}: { 
  children: React.ReactNode; 
  title: string;
  subtitle?: string;
  primaryAction?: any;
  fullWidth?: boolean;
}) {
  const [role, setRole] = useState("supplier");

  useEffect(() => {
    async function fetchRole() {
      try {
        const token = await getSessionToken();
        const res = await fetch("/api/dashboard-stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.role) setRole(data.role);
      } catch (err) {
        console.error("Failed to fetch shop role:", err);
      }
    }
    fetchRole();
  }, []);

  return (
    <Page 
      title={title} 
      subtitle={subtitle}
      primaryAction={primaryAction}
      fullWidth={fullWidth}
    >
      <AppNavigation role={role} />
      {fullWidth ? (
        <div className="w-full">
          {children}
        </div>
      ) : (
        <Layout>
          <Layout.Section>
            {children}
          </Layout.Section>
        </Layout>
      )}
    </Page>
  );
}
