import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Registers this device for Expo push notifications and stores the token so
// server-side jobs (due-date reminders, verification results, announcements) can reach it.
// Requires an EAS projectId (set once `eas init` has been run) — silently no-ops until then.
export async function registerPushToken(userId: string) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("No EAS projectId configured yet — skipping push token registration.");
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase
      .from("push_tokens")
      .upsert({ user_id: userId, expo_push_token: token }, { onConflict: "expo_push_token" });
  } catch (err) {
    console.warn("Failed to register push token", err);
  }
}
