import { Inngest } from "inngest";

// Define the events our app will send to Inngest
type Events = {
  "app/inventory.updated": {
    data: {
      shopDomain: string;
      inventoryItemId: number;
      available: number;
    };
  };
};

// Create the Inngest client
export const inngest = new Inngest({ id: "omnipartner-hub" });
