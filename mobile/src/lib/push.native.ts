import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { mobileApi } from "@/lib/api";
import type { RegisterDeviceForPush } from "@/lib/push";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export const registerDeviceForPush: RegisterDeviceForPush = async () => {
  if (!Device.isDevice) return;

  const current = await Notifications.getPermissionsAsync();
  const finalStatus =
    current.status === "granted"
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: projectId(),
  });
  await mobileApi("/api/mobile/devices/register", {
    body: {
      expoPushToken: token.data,
      platform: Platform.OS,
      deviceName: Device.deviceName,
      appVersion: Constants.expoConfig?.version ?? null,
    },
  });
};
