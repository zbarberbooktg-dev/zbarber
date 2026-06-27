import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Show alerts/sounds while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permission and resolve the device's Expo push token.
 * Returns null on simulators, on the web, or when permission is denied — the
 * caller treats a null token as "nothing to register".
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenResponse.data;
  } catch {
    return null;
  }
}

/**
 * Register the device's push token with the API. `authedFetch` must attach the
 * Clerk bearer token. Best-effort: failures are swallowed so a registration
 * problem never breaks the sign-in flow.
 */
export async function registerPushToken(
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>,
): Promise<string | null> {
  try {
    const token = await getExpoPushToken();
    if (!token) return null;
    await authedFetch("/api/notifications/device-token", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    return token;
  } catch {
    return null;
  }
}

/** Unregister a previously registered token (best-effort, e.g. on sign-out). */
export async function unregisterPushToken(
  authedFetch: (path: string, init?: RequestInit) => Promise<unknown>,
  token: string,
): Promise<void> {
  try {
    await authedFetch("/api/notifications/device-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  } catch {
    // ignore
  }
}
