import { Session } from "@shopify/shopify-api";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export class DrizzleSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
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
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const record = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!record) return undefined;

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
