"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "../components/AdminLayout";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
  Button,
  Modal,
  FormLayout,
  TextField,
  BlockStack,
  Banner,
  Spinner,
  EmptyState,
  Box,
  InlineStack,
  Link,
} from "@shopify/polaris";
import { getSessionToken } from "../lib/session";

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [shop, setShop] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newHandle, setNewHandle] = useState("");

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      const res = await fetch("/api/partners", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPartners(data.partners || []);
      setShop(data.shop || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleAddPartner = async () => {
    setModalLoading(true);
    try {
      const token = await getSessionToken();
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName, email: newEmail, handle: newHandle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setIsModalOpen(false);
      setNewName("");
      setNewEmail("");
      setNewHandle("");
      fetchPartners();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const resourceName = { singular: "partner", plural: "partners" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(partners);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const rowMarkup = partners.map(({ id, name, email, handle, tier }, index) => {
    const boutiqueUrl = `https://${shop}/apps/omnipartner-hub/store/${handle}`;
    return (
      <IndexTable.Row
        id={id.toString()}
        key={id}
        selected={selectedResources.includes(id.toString())}
        position={index}
      >
        <IndexTable.Cell>
          <div onClick={(e) => e.stopPropagation()}>
            <Link
              url={`/partners/${id}`}
              dataPrimaryLink
            >
              <Text variant="bodyMd" fontWeight="bold" as="span">
                {name}
              </Text>
            </Link>
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>{email}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">{`Tier ${tier}`}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack align="start" gap="200">
            <code style={{ fontSize: "12px" }}>{boutiqueUrl}</code>
            <Button size="slim" onClick={() => copyToClipboard(boutiqueUrl)}>
              Copy
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <AdminLayout title="Partner Network" fullWidth titleHidden>
      <div className="w-full px-8 py-6 font-sans bg-[#F9FAFB] min-h-screen">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1C1E]">Partner Network</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your active partners and scale your collaborative reach.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-[#008060] text-white rounded-xl text-sm font-bold hover:bg-[#006e52] transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Add Partner
            </button>
          </div>
        </div>

        {/* Network Stats Overiew */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "TOTAL PARTNERS", value: partners.length.toString(), icon: "🤝", color: "blue" },
            { label: "ACTIVE HUB BOUTIQUES", value: partners.length.toString(), icon: "🛍️", color: "emerald" },
            { label: "NETWORK REACH", value: "4.2k", icon: "📈", color: "purple" },
            { label: "PENDING INVITES", value: "0", icon: "📨", color: "amber" },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                  ${stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 
                    stat.color === 'purple' ? 'bg-purple-50 text-purple-600' :
                    'bg-amber-50 text-amber-600'}`}>
                  {stat.icon}
                </span>
                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold text-[#1A1C1E]">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 px-6 flex justify-between items-center border-b border-gray-50 bg-white">
            <div className="flex gap-4 items-center">
              <span className="text-sm font-bold text-[#1A1C1E]">Active Partners</span>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex gap-2">
                {["All", "Tier 1", "Tier 2"].map((t) => (
                  <button key={t} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors ${t === 'All' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                🔍 Search
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#FBFBFB] border-b border-gray-100">
                <tr>
                  <th className="py-4 pl-6 w-12"><input type="checkbox" className="rounded border-gray-300" /></th>
                  <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Partner Name</th>
                  <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contact Email</th>
                  <th className="py-4 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status & Tier</th>
                  <th className="py-4 pr-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Boutique URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      <Spinner size="large" />
                    </td>
                  </tr>
                ) : partners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <div className="flex flex-col items-center max-w-[320px] mx-auto">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                          <span className="text-3xl grayscale opacity-30 text-emerald-500">🤝</span>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 mb-2">Start your partner network</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          Recruit partners to expand your reach. Once added, you can manage their boutiques and track performance.
                        </p>
                        <button 
                          onClick={() => setIsModalOpen(true)}
                          className="mt-6 px-5 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                        >
                          Add Your First Partner
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  partners.map(({ id, name, email, handle, tier }) => {
                    const boutiqueUrl = `https://${shop}/apps/omnipartner-hub/store/${handle}`;
                    return (
                      <tr key={id} className="hover:bg-gray-50 transition-colors group">
                        <td className="py-5 pl-6"><input type="checkbox" className="rounded border-gray-300" /></td>
                        <td className="py-5 px-4 underline-offset-4">
                          <a href={`/partners/${id}`} className="text-sm font-bold text-[#1A1C1E] hover:text-[#008060] transition-colors">
                            {name}
                          </a>
                        </td>
                        <td className="py-5 px-4 text-sm text-gray-500">{email}</td>
                        <td className="py-5 px-4 font-sans">
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                              Tier {tier}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                              Active
                            </span>
                          </div>
                        </td>
                        <td className="py-5 pr-6 text-right">
                          <div className="inline-flex items-center gap-2 bg-gray-50 p-1 pl-3 rounded-lg border border-gray-100">
                            <span className="text-[11px] text-gray-500 font-mono truncate max-w-[140px]">{boutiqueUrl}</span>
                            <button 
                              onClick={() => copyToClipboard(boutiqueUrl)}
                              className="w-10 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 px-6 bg-white border-t border-gray-50 flex justify-between items-center text-[12px] text-gray-500">
            <span>Showing {partners.length} of {partners.length} active partners</span>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded border border-gray-100 flex items-center justify-center hover:bg-gray-50 text-gray-400">‹</button>
              <button className="w-8 h-8 rounded border border-gray-100 flex items-center justify-center hover:bg-gray-50 text-gray-400">›</button>
            </div>
          </div>
        </div>

        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add New Partner"
          primaryAction={{
            content: "Create Partner",
            onAction: handleAddPartner,
            loading: modalLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsModalOpen(false),
            },
          ]}
        >
          <div className="p-2">
            <Modal.Section>
              <FormLayout>
                <TextField
                  label="Full Name"
                  value={newName}
                  onChange={setNewName}
                  autoComplete="name"
                  placeholder="e.g. John Doe"
                />
                <TextField
                  label="Email"
                  type="email"
                  value={newEmail}
                  onChange={setNewEmail}
                  autoComplete="email"
                  placeholder="john@example.com"
                />
                <TextField
                  label="Partner Handle (for Link)"
                  value={newHandle}
                  onChange={setNewHandle}
                  prefix="@"
                  helpText="This will be used in their affiliate boutique URL."
                  autoComplete="off"
                  placeholder="johndoe"
                />
              </FormLayout>
            </Modal.Section>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
