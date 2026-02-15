import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

import { db } from "./lib/db";
import { sessions } from "./lib/db/schema";

async function checkSessions() {
  console.log("Checking sessions in DB...");
  const allSessions = await db.select().from(sessions);
  console.log("Found sessions:", allSessions.length);
  allSessions.forEach(s => {
      console.log(`- ID: ${s.id}, Shop: ${s.shop}, Online: ${s.isOnline}`);
  });
  process.exit(0);
}

checkSessions().catch(console.error);
