import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { mobileApi } from "@/lib/api";

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

export async function registerDeviceForPush() {
  // 웹 배포에서는 브라우저 알림 권한 팝업만 뜨고 VAPID 미설정으로 토큰 발급이
  // 실패한다 — 웹 푸시를 정식 지원하기 전까지 웹에서는 등록하지 않는다.
  if (Platform.OS === "web") return;
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
}
