import { inngest } from "./client";
import { db } from "@/lib/db";
import { shops, hubConnections } from "@/lib/db/schema";
import { shopify, sessionStorage } from "@/lib/shopify";
import { eq, sql } from "drizzle-orm";

export const syncInventoryLevels = inngest.createFunction(
  {
    id: "sync-inventory-levels",
    // Concurrency is critical to avoid blowing past Shopify's API rate limits
    concurrency: {
      limit: 2,
    },
    // Automatic retries if a network request fails
    retries: 3,
  },
  { event: "app/inventory.updated" },
  async ({ event, step }) => {
    const { shopDomain, inventoryItemId, available } = event.data;

    // We use raw SQL queries to search inside the JSONB mapping column efficiently
    const connectionsToUpdate = await step.run("fetch-retailers", async () => {
      // Find all active connections where this supplier's inventory item is mapped
      return await db.select().from(hubConnections)
        .leftJoin(shops, eq(hubConnections.retailerShopId, shops.id))
        .where(
          sql`${hubConnections.isActive} = true AND ${hubConnections.inventoryItemMapping}::jsonb @> ${JSON.stringify({ [inventoryItemId]: true })}::jsonb`
        );
    });

    if (!connectionsToUpdate || connectionsToUpdate.length === 0) {
      return { success: true, message: "No retailer connections matched this inventory item." };
    }

    // Since we can't easily query JSONB keys cleanly with drizzle raw SQL mapping,
    // we fetch them all and filter the connections where supplier value matches.
    const validConnections = await step.run("filter-connections", async () => {
      const allActive = await db.query.hubConnections.findMany({
        where: eq(hubConnections.isActive, true),
        with: { retailerShop: true },
      });

      return allActive.filter(c => {
        if (!c.inventoryItemMapping) return false;
        // Check if any retailer_inventory_item_id mapped to this supplier_inventory_item_id
        const map = c.inventoryItemMapping as Record<string, string>;
        return Object.values(map).includes(String(inventoryItemId));
      });
    });


    if (validConnections.length === 0) {
      return { success: true, message: "No valid mappings found after filtering." };
    }

    // Process each retailer sequentially or batch them safely
    await step.run("sync-to-retailers", async () => {
      const results = [];

      for (const connection of validConnections) {
        if (!connection.retailerShop?.shop) continue;

        try {
          // Find the specific retailer inventory item ID
          const map = connection.inventoryItemMapping as Record<string, string>;
          const retailerInventoryItemId = Object.keys(map).find(
            key => map[key] === String(inventoryItemId)
          );

          if (!retailerInventoryItemId) continue;

          const retailerSessionId = `offline_${connection.retailerShop.shop}`;
          const retailerSession = await sessionStorage.loadSession(retailerSessionId);

          if (!retailerSession) continue;

          const retailerClient = new shopify.clients.Graphql({ session: retailerSession });

          // We use GraphQL to set inventory levels because it automatically finds the location
          // associated with the App, which is safer than REST where location_id is mandatory.
          const mutation = `
            mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
              inventorySetQuantities(input: $input) {
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          const variables = {
            input: {
              name: "available",
              reason: "correction",
              quantities: [
                {
                  inventoryItemId: `gid://shopify/InventoryItem/${retailerInventoryItemId}`,
                  locationId: `gid://shopify/Location/`, // We need the location ID first
                  quantity: available,
                }
              ]
            }
          };

          // Wait, actually, GraphQL inventorySetQuantities requires LocationID. 
          // Let's use the REST API point location_id instead, by fetching locations.
          const restClient = new shopify.clients.Rest({ session: retailerSession });
          
          // 1. Get primary location for the retailer app
          const locationsResponse = await restClient.get({ path: "locations" });
          const locations = (locationsResponse.body as any).locations;
          // Standard dropshipping apps use the primary location, or the app-specific fulfillment location
          const primaryLocation = locations.find((l: any) => l.primary) || locations[0];

          if (!primaryLocation) {
             throw new Error("No location found for retailer");
          }

          // 2. Set the exact inventory level
          await restClient.post({
            path: "inventory_levels/set",
            data: {
              location_id: primaryLocation.id,
              inventory_item_id: Number(retailerInventoryItemId),
              available: available,
            }
          });

          results.push(`Updated ${connection.retailerShop.shop} to ${available}`);
        } catch (err: any) {
          console.error(`[Inngest] Sync failed for ${connection.retailerShop.shop}`, err.response?.body || err.message);
          // Optional: rethrow to trigger Inngest retry, or continue to not block others
        }
      }

      return results;
    });

    return { 
      success: true, 
      message: `Synced ${available} stock to ${validConnections.length} retailers.` 
    };
  }
);
