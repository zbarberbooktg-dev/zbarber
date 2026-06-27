import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { db, deviceTokensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

// A single shared Expo client. No access token is required for the public Expo
// push service; EXPO_ACCESS_TOKEN is honoured if set (enables enhanced security
// on the Expo dashboard) but is entirely optional.
const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : undefined,
);

/**
 * Send a push notification to every device registered for a user. Fully
 * fire-and-forget: it never throws, so callers can invoke it without awaiting
 * and a push failure can never break the originating request. Invalid /
 * unregistered tokens (DeviceNotRegistered) are pruned automatically.
 */
export async function sendPush(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const rows = await db
      .select({ token: deviceTokensTable.token })
      .from(deviceTokensTable)
      .where(eq(deviceTokensTable.userId, userId));

    const tokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: data ?? {},
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...receipts);
      } catch (err) {
        logger.error({ err, userId }, "Expo push chunk failed");
      }
    }

    // Prune tokens that Expo reports as no longer registered, so we stop trying
    // to deliver to uninstalled apps / revoked tokens.
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered" &&
        tokens[i]
      ) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      await db.delete(deviceTokensTable).where(inArray(deviceTokensTable.token, dead));
      logger.info({ count: dead.length }, "Pruned unregistered push tokens");
    }
  } catch (err) {
    logger.error({ err, userId }, "sendPush failed");
  }
}
