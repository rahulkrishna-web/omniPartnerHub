import { Session } from "@shopify/shopify-api";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export class DrizzleSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    console.log(`Debug Session: Storing session ${session.id} for shop ${session.shop}`);
    try {
        await db
          .insert(sessions)
          .values({
            id: session.id,
            shop: session.shop,
            state: session.state,
            isOnline: session.isOnline,
            scope: session.scope,
            expires: session.expires,
            accessToken: session.accessToken,
            userId: (session.onlineAccessInfo?.associated_user?.id as unknown as string) || null, 
          })
          .onConflictDoUpdate({
            target: sessions.id,
            set: {
              shop: session.shop,
              state: session.state,
              isOnline: session.isOnline,
              scope: session.scope,
              expires: session.expires,
              accessToken: session.accessToken,
              userId: (session.onlineAccessInfo?.associated_user?.id as unknown as string) || null,
            },
          });
        console.log(`Debug Session: Stored ${session.id} successfully`);
        return true;
    } catch (e) {
        console.error(`Debug Session: Failed to store session ${session.id}:`, e);
        return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    console.log(`Debug Session: Loading session ${id}`);
    try {
        const record = await db.query.sessions.findFirst({
          where: eq(sessions.id, id),
        });

        if (!record) {
            console.warn(`Debug Session: Session ${id} not found in DB`);
            return undefined;
        }

        console.log(`Debug Session: Found session ${id}`);
        return new Session({
          id: record.id,
          shop: record.shop,
          state: record.state,
          isOnline: record.isOnline || false,
          scope: record.scope || undefined,
          expires: record.expires || undefined,
          accessToken: record.accessToken || undefined,
          onlineAccessInfo: record.userId ? { associated_user: { id: Number(record.userId) } } as any : undefined,
        });
    } catch (e) {
        console.error(`Debug Session: Failed to load session ${id}:`, e);
        return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    await db.delete(sessions).where(eq(sessions.id, id));
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    for (const id of ids) {
      await this.deleteSession(id);
    }
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const records = await db.query.sessions.findMany({
      where: eq(sessions.shop, shop),
    });

    return records.map((record) => new Session({
      id: record.id,
      shop: record.shop,
      state: record.state,
      isOnline: record.isOnline || false,
      scope: record.scope || undefined,
      expires: record.expires || undefined,
      accessToken: record.accessToken || undefined,
    }));
  }
}
