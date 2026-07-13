import type { RegisterDeviceForPush } from "@/lib/push";

/** Browser push is intentionally disabled until a VAPID-backed flow exists. */
export const registerDeviceForPush: RegisterDeviceForPush = async () => {};
